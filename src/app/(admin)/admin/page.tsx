import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { allowedNav } from "@/lib/auth/rbac";

/** Routes each role to the first console section it is permitted to see. */
export default async function AdminIndex() {
  const user = await getCurrentUser();
  if (!user || user.role === "CUSTOMER") redirect("/login");
  const nav = allowedNav(user.permissions);
  redirect(nav[0]?.href ?? "/login");
}
