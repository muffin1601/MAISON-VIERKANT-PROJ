import type { DefaultSession } from "next-auth";
import type { RoleKey } from "@/lib/auth/rbac";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: RoleKey;
      permissions: string[];
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: RoleKey;
    permissions: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: RoleKey;
    permissions: string[];
  }
}
