import { cn } from '@/lib/utils';

const palette: Record<string, string> = {
  gray: 'bg-muted text-muted-foreground',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  green: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-300',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300',
  orange: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  red: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  purple: 'bg-purple-100 text-purple-800 dark:bg-purple-500/15 dark:text-purple-300',
};

export function StatusBadge({
  label,
  tone = 'gray',
  className,
}: {
  label: string;
  tone?: keyof typeof palette;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        palette[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function dealStageTone(isWon: boolean, isLost: boolean, probability: number) {
  if (isWon) return 'green' as const;
  if (isLost) return 'red' as const;
  if (probability >= 75) return 'blue' as const;
  if (probability >= 40) return 'yellow' as const;
  return 'gray' as const;
}

export function eventStatusTone(status: string) {
  switch (status) {
    case 'tentative':
      return 'gray' as const;
    case 'confirmed':
      return 'blue' as const;
    case 'in_prep':
    case 'in_progress':
      return 'yellow' as const;
    case 'delivered':
    case 'completed':
      return 'green' as const;
    case 'cancelled':
      return 'red' as const;
    default:
      return 'gray' as const;
  }
}

export function quoteStatusTone(status: string) {
  switch (status) {
    case 'draft':
      return 'gray' as const;
    case 'sent':
    case 'viewed':
      return 'blue' as const;
    case 'accepted':
    case 'converted':
      return 'green' as const;
    case 'declined':
    case 'expired':
      return 'red' as const;
    default:
      return 'gray' as const;
  }
}

export function invoiceStatusTone(status: string) {
  switch (status) {
    case 'draft':
      return 'gray' as const;
    case 'open':
      return 'blue' as const;
    case 'paid':
      return 'green' as const;
    case 'partially_paid':
      return 'yellow' as const;
    case 'past_due':
      return 'red' as const;
    case 'refunded':
      return 'purple' as const;
    default:
      return 'gray' as const;
  }
}
