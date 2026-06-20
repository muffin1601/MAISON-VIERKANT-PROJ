/**
 * Non-destructive grant of the offline-payment permissions to existing roles.
 * Safe to run against production — it only upserts the two new permissions and
 * grants them; it never deletes data (unlike the full seed).
 *
 *   npx tsx prisma/tools/add-payment-permissions.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const NEW_PERMS = ["payments.read", "payments.write"] as const;

// Which existing roles receive each new permission.
const GRANTS: Record<string, string[]> = {
  SUPER_ADMIN: ["payments.read", "payments.write"],
  ADMIN: ["payments.read", "payments.write"],
  SALES_MANAGER: ["payments.read", "payments.write"],
};

async function main() {
  // 1) Ensure the permission rows exist.
  for (const key of NEW_PERMS) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
  const permByKey = new Map(
    (await prisma.permission.findMany({ where: { key: { in: [...NEW_PERMS] } } })).map((p) => [p.key, p.id]),
  );

  // 2) Grant to the configured roles (idempotent).
  for (const [roleKey, perms] of Object.entries(GRANTS)) {
    const role = await prisma.role.findUnique({ where: { key: roleKey } });
    if (!role) {
      console.log(`• role ${roleKey} not found — skipped`);
      continue;
    }
    for (const perm of perms) {
      const permissionId = permByKey.get(perm)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
    console.log(`✓ granted [${perms.join(", ")}] to ${roleKey}`);
  }
  console.log("Done. Users must re-login for new permissions to take effect (JWT is cached).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
