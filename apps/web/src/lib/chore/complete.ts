import type { SupabaseClient } from "@supabase/supabase-js";
import { decideFromVerdict, verifyChorePhotos, type ChoreVerdict } from "@/lib/ai/verifyChore";

// Private Supabase Storage bucket for chore before/after photos.
export const CHORE_PHOTO_BUCKET = "chore-photos";

/** Pure: should we attempt AI verification for this completion? Unit-tested. */
export function shouldRunAi(
  approvalMode: string,
  hasAfterPhoto: boolean,
  configured: boolean,
): boolean {
  return approvalMode === "ai" && hasAfterPhoto && configured;
}

/**
 * Mint short-lived signed URLs for stored photo paths and ask the AI for a verdict.
 * `signer` MUST be able to read the private bucket (the service-role/admin client) —
 * the child has no JWT, so storage RLS can never authorize it directly.
 * Any error falls back to manual parent approval.
 */
export async function runAiDecision(
  signer: SupabaseClient,
  input: { choreName: string; beforePath: string | null; afterPath: string },
  threshold = 0.8,
): Promise<{ decision: "ai_approved" | "parent"; verdict: ChoreVerdict | null }> {
  try {
    const paths = input.beforePath ? [input.beforePath, input.afterPath] : [input.afterPath];
    const { data: signed, error } = await signer.storage
      .from(CHORE_PHOTO_BUCKET)
      .createSignedUrls(paths, 300);
    if (error || !signed) return { decision: "parent", verdict: null };

    const byPath = new Map(signed.map((s) => [s.path, s.signedUrl] as const));
    const afterUrl = byPath.get(input.afterPath);
    if (!afterUrl) return { decision: "parent", verdict: null };
    const beforeUrl = input.beforePath ? byPath.get(input.beforePath) ?? null : null;

    const verdict = await verifyChorePhotos({ choreName: input.choreName, beforeUrl, afterUrl });
    return { decision: decideFromVerdict(verdict, threshold), verdict };
  } catch {
    return { decision: "parent", verdict: null };
  }
}

/**
 * Insert an earn ledger entry and finalize the completion. Balance updates via DB trigger.
 * Works with either the RLS client (parent) or the admin client (child) — it only uses
 * generic `.from()` calls.
 */
export async function creditCompletion(
  client: SupabaseClient,
  args: {
    familyId: string;
    childId: string;
    completionId: string;
    minutes: number;
    status: "approved" | "auto_approved" | "ai_approved";
    decidedBy?: string | null;
    note?: string | null;
    verdict?: unknown;
  },
) {
  const { data: entry } = await client
    .from("ledger_entries")
    .insert({
      family_id: args.familyId,
      child_id: args.childId,
      delta_minutes: args.minutes,
      kind: "earn_chore",
      source_type: "chore_completion",
      source_id: args.completionId,
      note: args.note ?? null,
      created_by: args.decidedBy ?? null,
    })
    .select("id")
    .single();

  await client
    .from("chore_completions")
    .update({
      status: args.status,
      minutes_awarded: args.minutes,
      ledger_entry_id: entry?.id ?? null,
      decided_by: args.decidedBy ?? null,
      decided_at: new Date().toISOString(),
      ai_verdict: args.verdict ?? null,
    })
    .eq("id", args.completionId);
}
