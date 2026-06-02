'use client';

import { Printer } from 'lucide-react';

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-2 rounded-md bg-black px-4 text-sm font-medium text-white hover:opacity-90"
    >
      <Printer className="h-4 w-4" /> Print / Save as PDF
    </button>
  );
}
