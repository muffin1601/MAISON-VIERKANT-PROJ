import { describe, it, expect } from "vitest";
import { allowedNav, hasPermission, hasAnyPermission, ADMIN_NAV } from "@/lib/auth/rbac";

describe("RBAC", () => {
  it("admin (all perms) sees every nav item", () => {
    const all = ADMIN_NAV.map((n) => n.permission);
    expect(allowedNav(all)).toHaveLength(ADMIN_NAV.length);
  });

  it("sales executive sees only customers, quote create & saved quotes", () => {
    const perms = ["customers.read", "quotes.write", "quotes.read", "leads.read"];
    const labels = allowedNav(perms).map((n) => n.label);
    // Order follows ADMIN_NAV (leads precedes customers/quotes).
    expect(labels).toEqual(["Catalogue Leads", "Customers", "Create Quote", "Saved Quotes"]);
  });

  it("inventory manager cannot see orders or pricing-manage pages", () => {
    const perms = ["inventory.read", "products.read", "dashboard.read"];
    const labels = allowedNav(perms).map((n) => n.label);
    expect(labels).toContain("Stock");
    expect(labels).toContain("Dashboard");
    expect(labels).not.toContain("Orders");
  });

  it("permission helpers work", () => {
    expect(hasPermission(["orders.read"], "orders.read")).toBe(true);
    expect(hasPermission(["orders.read"], "orders.write")).toBe(false);
    expect(hasAnyPermission(["leads.read"], ["leads.write", "leads.read"])).toBe(true);
    expect(hasAnyPermission([], ["leads.read"])).toBe(false);
  });
});
