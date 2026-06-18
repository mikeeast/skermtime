import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { REFERRAL_COOKIE } from "@/lib/family/server";

// Referral landing. Stash the code in a cookie and send the visitor to sign up;
// createFamily() redeems it once they create their family.
export default async function ReferralPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const jar = await cookies();
  jar.set(REFERRAL_COOKIE, code, { path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/login");
}
