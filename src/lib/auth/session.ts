import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { hasPermission, type Permission } from "@/lib/auth/rbac";

export class AuthError extends Error {
  constructor(
    public code: "UNAUTHENTICATED" | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface SessionUser {
  id: string;
  email?: string | null;
  name?: string | null;
  role: string;
  permissions: string[];
}

/** Current user or null. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  return (session?.user as SessionUser) ?? null;
}

/** Require an authenticated user (throws AuthError otherwise). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("UNAUTHENTICATED", "Authentication required");
  return user;
}

/** Require a specific permission. Use at the top of every protected action / route handler. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (!hasPermission(user.permissions, permission)) {
    throw new AuthError("FORBIDDEN", `Missing permission: ${permission}`);
  }
  return user;
}

/**
 * Wrap a Server Action / handler so it only runs with the given permission.
 *   export const updateProduct = withPermission("products.write", async (user, input) => { ... })
 */
export function withPermission<Args extends unknown[], R>(
  permission: Permission,
  fn: (user: SessionUser, ...args: Args) => Promise<R>,
): (...args: Args) => Promise<R> {
  return async (...args: Args) => {
    const user = await requirePermission(permission);
    return fn(user, ...args);
  };
}
