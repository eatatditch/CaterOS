/**
 * Dispatch status values, in workflow order. Kept in a plain module (not the
 * 'use server' actions file) so the const/type can be imported by client and
 * server components — a 'use server' file may only export async functions.
 */
export const DISPATCH_STATUSES = [
  'unassigned',
  'assigned',
  'en_route',
  'arrived',
  'delivered',
  'completed',
] as const;

export type DispatchStatus = (typeof DISPATCH_STATUSES)[number];
