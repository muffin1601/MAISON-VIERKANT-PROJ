/**
 * Lead vocabulary shared between the server action and client components.
 * Kept in a plain module (NOT the "use server" actions file) because server-action
 * modules may only export async functions — a non-function export there becomes a
 * server-reference proxy on the client, breaking `.map`/`.includes` at runtime.
 */
export const LEAD_STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "WON", "LOST"] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];
