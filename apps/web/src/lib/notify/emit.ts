import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "./email";
import {
  approvalPendingEmail,
  lowBalanceEmail,
  weeklySummaryEmail,
  type EmailContent,
} from "./templates";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://skermtime.vercel.app";

type Prefs = {
  email_approvals: boolean;
  email_low_balance: boolean;
  email_weekly: boolean;
  low_balance_threshold: number;
};

async function ownerEmail(admin: SupabaseClient, familyId: string): Promise<string | null> {
  const { data: fam } = await admin.from("families").select("owner_id").eq("id", familyId).single();
  if (!fam?.owner_id) return null;
  const { data } = await admin.auth.admin.getUserById(fam.owner_id as string);
  return data?.user?.email ?? null;
}

/**
 * Idempotent dispatch: insert the dedupe row FIRST; only send if the insert won
 * (a unique-conflict means we already notified). Respects the family's prefs.
 */
async function dispatch(
  admin: SupabaseClient,
  args: {
    familyId: string;
    childId?: string | null;
    type: "approval_pending" | "low_balance" | "weekly_summary";
    dedupeKey: string;
    prefCheck?: (p: Prefs) => boolean;
  },
  build: () => EmailContent,
): Promise<boolean> {
  const { data: prefs } = await admin
    .from("notification_prefs")
    .select("*")
    .eq("family_id", args.familyId)
    .maybeSingle();
  if (prefs && args.prefCheck && !args.prefCheck(prefs as Prefs)) return false;

  const { data: inserted, error } = await admin
    .from("notifications")
    .insert({
      family_id: args.familyId,
      child_id: args.childId ?? null,
      type: args.type,
      dedupe_key: args.dedupeKey,
    })
    .select("id")
    .maybeSingle();
  if (error || !inserted) return false; // already sent (unique conflict) or insert failed

  const to = await ownerEmail(admin, args.familyId);
  if (!to) return false;

  const content = build();
  const ok = await sendEmail(to, content.subject, content.html);
  if (ok) {
    await admin
      .from("notifications")
      .update({ sent_at: new Date().toISOString() })
      .eq("id", inserted.id);
  }
  return ok;
}

/** A chore completion is awaiting parent approval. Fire-and-forget. */
export async function notifyApprovalPending(
  admin: SupabaseClient,
  args: { familyId: string; childId: string; completionId: string; choreName: string },
): Promise<void> {
  try {
    const { data: child } = await admin
      .from("child_profiles")
      .select("alias")
      .eq("id", args.childId)
      .single();
    await dispatch(
      admin,
      {
        familyId: args.familyId,
        childId: args.childId,
        type: "approval_pending",
        dedupeKey: `approval:${args.completionId}`,
        prefCheck: (p) => p.email_approvals,
      },
      () =>
        approvalPendingEmail({
          childAlias: child?.alias ?? "Barnet",
          choreName: args.choreName,
          appUrl: APP_URL,
        }),
    );
  } catch {
    /* notifications are best-effort */
  }
}

/** A child's balance dropped to/under the family threshold (deduped per local day). */
export async function notifyLowBalance(
  admin: SupabaseClient,
  args: { familyId: string; childId: string; alias: string; minutes: number; day: string },
): Promise<boolean> {
  return dispatch(
    admin,
    {
      familyId: args.familyId,
      childId: args.childId,
      type: "low_balance",
      dedupeKey: `low_balance:${args.childId}:${args.day}`,
      prefCheck: (p) => p.email_low_balance,
    },
    () => lowBalanceEmail({ childAlias: args.alias, minutes: args.minutes, appUrl: APP_URL }),
  );
}

/** Weekly per-family summary (deduped per ISO week key). */
export async function notifyWeeklySummary(
  admin: SupabaseClient,
  args: {
    familyId: string;
    weekKey: string;
    items: { alias: string; earned: number; spent: number }[];
  },
): Promise<boolean> {
  return dispatch(
    admin,
    {
      familyId: args.familyId,
      type: "weekly_summary",
      dedupeKey: `weekly:${args.weekKey}`,
      prefCheck: (p) => p.email_weekly,
    },
    () => weeklySummaryEmail({ items: args.items, appUrl: APP_URL }),
  );
}
