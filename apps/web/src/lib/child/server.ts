import { cookies } from "next/headers";
import { verifyChildToken } from "./session";

export const CHILD_COOKIE = "skermtime_child";

/** The signed-in child's id (from the session cookie), or null. */
export async function getChildId(): Promise<string | null> {
  const jar = await cookies();
  return verifyChildToken(jar.get(CHILD_COOKIE)?.value);
}
