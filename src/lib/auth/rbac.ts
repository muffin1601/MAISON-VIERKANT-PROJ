/**
 * RBAC vocabulary shared across the app. Permission strings are the source of authority;
 * roles are bundles of permissions (seeded in the DB). The admin nav maps 1:1 to the
 * prototype's pages, gated by permission.
 */
export type Permission =
  | "dashboard.read"
  | "pricing.read"
  | "pricing.manage"
  | "products.read"
  | "products.write"
  | "inventory.read"
  | "inventory.write"
  | "orders.read"
  | "orders.write"
  | "payments.read"
  | "payments.write"
  | "leads.read"
  | "leads.write"
  | "customers.read"
  | "customers.write"
  | "quotes.read"
  | "quotes.write"
  | "quotes.approve"
  | "purchase.read"
  | "purchase.write"
  | "settings.manage"
  | "users.manage"
  | "audit.read";

export type RoleKey =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "SALES_MANAGER"
  | "SALES_EXECUTIVE"
  | "INVENTORY_MANAGER"
  | "CUSTOMER";

/** Admin console sections, each requiring a permission. Mirrors prototype admin nav. */
export interface AdminNavItem {
  href: string;
  label: string;
  permission: Permission;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", permission: "dashboard.read" },
  { href: "/admin/pricing", label: "Pricing Engine", permission: "pricing.read" },
  { href: "/admin/products", label: "Products", permission: "products.read" },
  { href: "/admin/stock", label: "Stock", permission: "inventory.read" },
  { href: "/admin/orders", label: "Orders", permission: "orders.read" },
  { href: "/admin/payments", label: "Payments", permission: "payments.read" },
  { href: "/admin/payment-settings", label: "Payment Settings", permission: "settings.manage" },
  { href: "/admin/leads", label: "Catalogue Leads", permission: "leads.read" },
  { href: "/admin/customers", label: "Customers", permission: "customers.read" },
  { href: "/admin/quotes", label: "Create Quote", permission: "quotes.write" },
  { href: "/admin/saved-quotes", label: "Saved Quotes", permission: "quotes.read" },
  { href: "/admin/purchase-orders", label: "Purchase Order", permission: "purchase.read" },
];

export function hasPermission(granted: string[], required: Permission): boolean {
  return granted.includes(required);
}

export function hasAnyPermission(granted: string[], required: Permission[]): boolean {
  return required.some((p) => granted.includes(p));
}

/** Filter the admin nav to what a user with these permissions may see. */
export function allowedNav(granted: string[]): AdminNavItem[] {
  return ADMIN_NAV.filter((item) => granted.includes(item.permission));
}
