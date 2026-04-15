import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Request form',
  robots: { index: false, follow: false },
};

// Force light mode on all /embed routes regardless of visitor's system preference
// or the app's theme — the iframe needs a clean, predictable white canvas so it
// blends with any host site.
const FORCE_LIGHT_CSS = `
  html, body { background: #ffffff !important; color: #18181b !important; color-scheme: light !important; }
  html.dark, .dark { background: #ffffff !important; color: #18181b !important; }
  html.dark *, .dark * { --background: 0 0% 100%; --foreground: 20 14.3% 4.1%; }
`;

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FORCE_LIGHT_CSS }} />
      <div
        style={{
          minHeight: '100vh',
          margin: 0,
          padding: '24px',
          background: '#ffffff',
          color: '#18181b',
          fontFamily:
            'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
          colorScheme: 'light',
        }}
      >
        {children}
      </div>
    </>
  );
}
