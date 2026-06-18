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
