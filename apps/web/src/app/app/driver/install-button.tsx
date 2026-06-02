'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

// Minimal beforeinstallprompt typing (not in lib.dom yet).
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Shows an "Install app" button when the browser offers an install prompt
 * (Android/Chromebook/desktop Chrome). iOS uses the native Share → Add to Home
 * Screen flow, so the button simply won't appear there.
 */
export function InstallButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => setPrompt(null));
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (!prompt) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice;
        setPrompt(null);
      }}
      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium"
    >
      <Download className="h-4 w-4" /> Install app
    </button>
  );
}
