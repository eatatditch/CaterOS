import type { MetadataRoute } from 'next';

// Next App Router serves this at /manifest.webmanifest and injects the
// <link rel="manifest"> tag automatically. Drives "Add to Home Screen" and
// the installed standalone experience used by drivers in the field.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CaterOS Driver',
    short_name: 'CaterOS',
    description: 'Deliveries and dispatch for CaterOS drivers.',
    start_url: '/app/driver',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0B1220',
    theme_color: '#0B1220',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
