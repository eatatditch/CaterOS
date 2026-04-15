export const WEB_FORM_FIELD_KEYS = [
  'last_name',
  'phone',
  'company',
  'event_date',
  'event_time',
  'service_type',
  'location',
  'guest_count',
  'message',
] as const;

export type WebFormFieldKey = (typeof WEB_FORM_FIELD_KEYS)[number];

export type WebFormSettings = {
  method: 'iframe' | 'script';
  accent: string;
  button_text: string;
  thanks_text: string;
  enabled_fields: WebFormFieldKey[];
  required_fields: WebFormFieldKey[];
};

export const DEFAULT_WEB_FORM_SETTINGS: WebFormSettings = {
  method: 'iframe',
  accent: '#ea580c',
  button_text: 'Request a quote',
  thanks_text: "Thanks! We'll be in touch shortly.",
  enabled_fields: [...WEB_FORM_FIELD_KEYS],
  required_fields: [],
};
