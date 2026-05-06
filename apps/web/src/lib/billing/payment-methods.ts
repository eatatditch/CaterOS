export const MANUAL_PAYMENT_METHODS = [
  'cash',
  'check',
  'card_in_person',
  'ach',
  'other',
] as const;

export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];
