import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Request form',
  robots: { index: false, follow: false },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        margin: 0,
        padding: '24px',
        background: 'transparent',
        fontFamily:
          'system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif',
      }}
    >
      {children}
    </div>
  );
}
