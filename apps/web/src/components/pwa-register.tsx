'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (once, after load) so the driver surface works
 * offline and is installable. No-ops where service workers are unavailable.
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* registration is best-effort; the app still works online */
      });
    };
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register);
      return () => window.removeEventListener('load', register);
    }
  }, []);

  return null;
}
