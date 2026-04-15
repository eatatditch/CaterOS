'use client';

import { useEffect, useRef, useState } from 'react';

export type FieldKey =
  | 'last_name'
  | 'phone'
  | 'company'
  | 'event_date'
  | 'event_time'
  | 'service_type'
  | 'location'
  | 'guest_count'
  | 'message';

type Props = {
  slug: string;
  fields: FieldKey[];
  required: FieldKey[];
  accent: string;
  buttonText: string;
  thanks: string;
  locations: { id: string; name: string }[];
  hideBranding: boolean;
};

export function EmbedForm({
  slug,
  fields,
  required,
  accent,
  buttonText,
  thanks,
  locations,
  hideBranding,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'idle' | 'submitting' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('Something went wrong. Please try again.');

  const show = (k: FieldKey) => fields.includes(k);
  const req = (k: FieldKey) => required.includes(k);

  // Tell the parent frame how tall we are so it can auto-size the iframe.
  useEffect(() => {
    if (!rootRef.current) return;
    let lastHeight = 0;
    const ro = new ResizeObserver(() => {
      if (!rootRef.current) return;
      const h = rootRef.current.scrollHeight;
      if (h !== lastHeight) {
        lastHeight = h;
        try {
          window.parent.postMessage({ source: 'cateros', type: 'resize', height: h + 48 }, '*');
        } catch {
          // ignore cross-origin rejections
        }
      }
    });
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!formRef.current) return;
    setState('submitting');

    const fd = new FormData(formRef.current);
    // Honeypot
    if ((fd.get('website') as string | null)?.length) {
      setState('ok');
      return;
    }

    // Derive a meaningful source from the host page's URL (Squarespace site
    // hostname, e.g. "eatatditch.com") when available, fall back to 'web_form'.
    let source = 'web_form';
    try {
      const ref = document.referrer;
      if (ref) {
        const u = new URL(ref);
        source = u.hostname.replace(/^www\./, '');
      }
    } catch {
      /* noop */
    }

    const payload: Record<string, string> = { source };
    fd.forEach((v, k) => {
      if (typeof v === 'string' && v.length > 0) payload[k] = v;
    });

    try {
      const res = await fetch(`/api/public/leads/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setState('ok');
        formRef.current.reset();
        try {
          window.parent.postMessage({ source: 'cateros', type: 'submit' }, '*');
        } catch {
          /* noop */
        }
      } else {
        setErrorMsg(
          body.error === 'org_not_found'
            ? 'Form not configured — contact the site owner.'
            : 'Something went wrong. Please try again.',
        );
        setState('error');
      }
    } catch {
      setState('error');
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    border: '1px solid #d4d4d8',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    background: '#fff',
    color: '#18181b',
    lineHeight: 1.4,
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: '4px',
    color: '#52525b',
  };

  const rowStyle: React.CSSProperties = { marginBottom: '12px' };
  const twoColStyle: React.CSSProperties = {
    ...rowStyle,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  };
  const reqMark = <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>;

  return (
    <div
      ref={rootRef}
      style={{
        maxWidth: '560px',
        margin: '0 auto',
        color: '#18181b',
        fontFamily: 'inherit',
      }}
    >
      {state === 'ok' ? (
        <div
          style={{
            padding: '20px',
            background: '#dcfce7',
            color: '#166534',
            borderRadius: '10px',
            textAlign: 'center',
            fontSize: '16px',
            fontWeight: 500,
          }}
        >
          {thanks}
        </div>
      ) : (
        <form ref={formRef} onSubmit={onSubmit} noValidate>
          <input
            type="text"
            name="website"
            autoComplete="off"
            tabIndex={-1}
            aria-hidden="true"
            style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}
          />

          <div style={show('last_name') ? twoColStyle : rowStyle}>
            <div>
              <label style={labelStyle}>First name{reqMark}</label>
              <input name="first_name" required style={inputStyle} />
            </div>
            {show('last_name') && (
              <div>
                <label style={labelStyle}>
                  Last name{req('last_name') ? reqMark : null}
                </label>
                <input name="last_name" required={req('last_name')} style={inputStyle} />
              </div>
            )}
          </div>

          <div style={show('phone') ? twoColStyle : rowStyle}>
            <div>
              <label style={labelStyle}>Email{reqMark}</label>
              <input name="email" type="email" required style={inputStyle} />
            </div>
            {show('phone') && (
              <div>
                <label style={labelStyle}>
                  Phone{req('phone') ? reqMark : null}
                </label>
                <input name="phone" type="tel" required={req('phone')} style={inputStyle} />
              </div>
            )}
          </div>

          {show('company') && (
            <div style={rowStyle}>
              <label style={labelStyle}>
                Company{req('company') ? reqMark : null}
              </label>
              <input name="company" required={req('company')} style={inputStyle} />
            </div>
          )}

          {(show('event_date') || show('event_time')) && (
            <div style={show('event_date') && show('event_time') ? twoColStyle : rowStyle}>
              {show('event_date') && (
                <div>
                  <label style={labelStyle}>
                    Event date{req('event_date') ? reqMark : null}
                  </label>
                  <input
                    name="event_date"
                    type="date"
                    required={req('event_date')}
                    style={inputStyle}
                  />
                </div>
              )}
              {show('event_time') && (
                <div>
                  <label style={labelStyle}>
                    Event time{req('event_time') ? reqMark : null}
                  </label>
                  <input
                    name="event_time"
                    type="time"
                    required={req('event_time')}
                    style={inputStyle}
                  />
                </div>
              )}
            </div>
          )}

          {show('service_type') && (
            <div style={rowStyle}>
              <label style={labelStyle}>
                Service type{req('service_type') ? reqMark : null}
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { v: 'on_premise', l: 'On-premise' },
                  { v: 'off_premise', l: 'Off-premise' },
                ].map((opt) => (
                  <label
                    key={opt.v}
                    style={{
                      flex: 1,
                      minWidth: '120px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '10px 12px',
                      border: '1px solid #d4d4d8',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: 500,
                      background: '#fff',
                      color: '#18181b',
                    }}
                    className="cx-seg-option"
                  >
                    <input
                      type="radio"
                      name="service_type"
                      value={opt.v}
                      required={req('service_type')}
                      style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                      onChange={(e) => {
                        const parent = (e.target as HTMLElement).closest(
                          '.cx-seg-option',
                        ) as HTMLElement | null;
                        const siblings = parent?.parentElement?.querySelectorAll(
                          '.cx-seg-option',
                        );
                        siblings?.forEach((s) => {
                          (s as HTMLElement).style.background = '#fff';
                          (s as HTMLElement).style.color = '#18181b';
                          (s as HTMLElement).style.borderColor = '#d4d4d8';
                        });
                        if (parent) {
                          parent.style.background = accent;
                          parent.style.color = '#fff';
                          parent.style.borderColor = accent;
                        }
                      }}
                    />
                    <span>{opt.l}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {show('location') && (
            <div style={rowStyle}>
              <label style={labelStyle}>
                Location to book{req('location') ? reqMark : null}
              </label>
              <select name="location_id" required={req('location')} style={inputStyle}>
                <option value="">—</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {show('guest_count') && (
            <div style={rowStyle}>
              <label style={labelStyle}>
                Number of guests{req('guest_count') ? reqMark : null}
              </label>
              <input
                name="guest_count"
                type="number"
                min={0}
                placeholder="e.g. 50"
                required={req('guest_count')}
                style={inputStyle}
              />
            </div>
          )}

          {show('message') && (
            <div style={rowStyle}>
              <label style={labelStyle}>
                Tell us about your event{req('message') ? reqMark : null}
              </label>
              <textarea
                name="message"
                rows={4}
                required={req('message')}
                style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
              />
            </div>
          )}

          {state === 'error' && (
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                borderRadius: 8,
                background: '#fee2e2',
                color: '#991b1b',
                fontSize: 14,
              }}
            >
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={state === 'submitting'}
            style={{
              width: '100%',
              padding: '12px 16px',
              border: 'none',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: state === 'submitting' ? 'wait' : 'pointer',
              background: accent,
              color: '#fff',
              opacity: state === 'submitting' ? 0.6 : 1,
            }}
          >
            {state === 'submitting' ? 'Sending\u2026' : buttonText}
          </button>

          {!hideBranding && (
            <div
              style={{
                marginTop: 10,
                textAlign: 'center',
                fontSize: 11,
                color: '#a1a1aa',
              }}
            >
              Powered by{' '}
              <a
                href="https://cater-os.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                CaterOS
              </a>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
