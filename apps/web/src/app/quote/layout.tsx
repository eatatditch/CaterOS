import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Your quote',
  robots: { index: false, follow: false },
};

const FORCE_LIGHT_CSS = `
  html, body { background: #fafafa !important; color: #18181b !important; color-scheme: light !important; }
  html.dark, .dark { background: #fafafa !important; color: #18181b !important; }
`;

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: FORCE_LIGHT_CSS }} />
      <div
        style={{
          minHeight: '100vh',
          margin: 0,
          background: '#fafafa',
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
