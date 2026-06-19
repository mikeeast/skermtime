"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getChildId } from "@/lib/child/server";

export async function requestFriend(formData: FormData) {
  const childId = await getChildId();
  if (!childId) redirect("/barn");
  const code = String(formData.get("code") ?? "")
    .trim()
    .toUpperCase();
  if (!code) return;

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("child_profiles")
    .select("id, alias, icon, family_id")
    .eq("id", childId)
    .single();
  if (!me) return;

  const { data: target } = await admin
    .from("child_profiles")
    .select("id, alias, icon, family_id")
    .eq("friend_code", code)
    .maybeSingle();
  if (!target || target.id === childId) {
    revalidatePath("/barn/kompisar");
    return;
  }

  const [a, b] = childId < target.id ? [childId, target.id] : [target.id, childId];
  const { data: alreadyFriends } = await admin
    .from("child_friendships")
    .select("child_a")
    .eq("child_a", a)
    .eq("child_b", b)
    .maybeSingle();
  if (alreadyFriends) {
    revalidatePath("/barn/kompisar");
    return;
  }

  await admin.from("child_friend_requests").upsert(
    {
      requester_child_id: childId,
      requester_family_id: me.family_id,
      requester_alias: me.alias,
      requester_icon: me.icon,
      target_child_id: target.id,
      target_family_id: target.family_id,
      target_alias: target.alias,
      target_icon: target.icon,
      status: "pending",
    },
    { onConflict: "requester_child_id,target_child_id", ignoreDuplicates: true },
  );
  revalidatePath("/barn/kompisar");
}

export async function cancelFriendRequest(formData: FormData) {
  const childId = await getChildId();
  if (!childId) redirect("/barn");
  const id = String(formData.get("requestId") ?? "");
  if (!id) return;
  const admin = createAdminClient();
  await admin.from("child_friend_requests").delete().eq("id", id).eq("requester_child_id", childId);
  revalidatePath("/barn/kompisar");
}

export async function removeFriend(formData: FormData) {
  const childId = await getChildId();
  if (!childId) redirect("/barn");
  const other = String(formData.get("friendId") ?? "");
  if (!other) return;
  const admin = createAdminClient();
  const [a, b] = childId < other ? [childId, other] : [other, childId];
  await admin.from("child_friendships").delete().eq("child_a", a).eq("child_b", b);
  revalidatePath("/barn/kompisar");
}

// ── Co-op challenges ──

const METRICS = ["distance_m", "runs", "earn_minutes"];

export async function createChallenge(formData: FormData) {
  const childId = await getChildId();
  if (!childId) redirect("/barn");
  const title = String(formData.get("title") ?? "").trim();
  const metric = String(formData.get("metric") ?? "");
  const goal = Number(formData.get("goal"));
  const days = Math.min(60, Math.max(1, Math.trunc(Number(formData.get("days")) || 7)));
  const reward = Math.max(0, Math.trunc(Number(formData.get("reward")) || 30));
  if (!title || !METRICS.includes(metric) || !Number.isFinite(goal) || goal <= 0) return;

  const admin = createAdminClient();
  const { data: me } = await admin
    .from("child_profiles")
    .select("family_id")
    .eq("id", childId)
    .single();
  if (!me) return;

  const endsAt = new Date(Date.now() + days * 86_400_000).toISOString();
  const { data: ch } = await admin
    .from("challenges")
    .insert({
      created_by_child: childId,
      family_id: me.family_id,
      title,
      metric,
      goal,
      reward_minutes: reward,
      ends_at: endsAt,
    })
    .select("id")
    .single();
  if (!ch) return;

  await admin
    .from("challenge_members")
    .insert({ challenge_id: ch.id, child_id: childId, family_id: me.family_id });
  revalidatePath("/barn/kompisar");
}

export async function joinChallenge(formData: FormData) {
  const childId = await getChildId();
  if (!childId) redirect("/barn");
  const challengeId = String(formData.get("challengeId") ?? "");
  if (!challengeId) return;

  const admin = createAdminClient();
  const { data: ch } = await admin
    .from("challenges")
    .select("id, status, created_by_child")
    .eq("id", challengeId)
    .maybeSingle();
  if (!ch || ch.status !== "active") return;

  // Only joinable if the creator is already a friend.
  const [a, b] =
    childId < ch.created_by_child ? [childId, ch.created_by_child] : [ch.created_by_child, childId];
  const { data: friend } = await admin
    .from("child_friendships")
    .select("child_a")
    .eq("child_a", a)
    .eq("child_b", b)
    .maybeSingle();
  if (!friend) return;

  const { data: me } = await admin
    .from("child_profiles")
    .select("family_id")
    .eq("id", childId)
    .single();
  if (!me) return;

  await admin
    .from("challenge_members")
    .upsert(
      { challenge_id: challengeId, child_id: childId, family_id: me.family_id },
      { onConflict: "challenge_id,child_id", ignoreDuplicates: true },
    );
  revalidatePath("/barn/kompisar");
}

export async function leaveChallenge(formData: FormData) {
  const childId = await getChildId();
  if (!childId) redirect("/barn");
  const challengeId = String(formData.get("challengeId") ?? "");
  if (!challengeId) return;
  const admin = createAdminClient();
  await admin
    .from("challenge_members")
    .delete()
    .eq("challenge_id", challengeId)
    .eq("child_id", childId);
  revalidatePath("/barn/kompisar");
}
