import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type EventLite = {
  id: string;
  name: string;
  status: string;
  starts_at: string;
  headcount: number;
};

export function EventCalendar({
  monthStr,
  events,
}: {
  monthStr: string;
  events: EventLite[];
}) {
  const parts = monthStr.split('-');
  const year = parseInt(parts[0] ?? '', 10);
  const monthNum = parseInt(parts[1] ?? '', 10);
  const firstOfMonth = new Date(Date.UTC(year, monthNum - 1, 1));
  const monthName = firstOfMonth.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const startWeekday = firstOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();

  const prevMonth = new Date(Date.UTC(year, monthNum - 2, 1));
  const nextMonth = new Date(Date.UTC(year, monthNum, 1));
  const prevParam = `${prevMonth.getUTCFullYear()}-${String(prevMonth.getUTCMonth() + 1).padStart(2, '0')}`;
  const nextParam = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}`;

  const byDay = new Map<number, EventLite[]>();
  for (const ev of events) {
    const d = new Date(ev.starts_at);
    const day = d.getUTCDate();
    byDay.set(day, [...(byDay.get(day) ?? []), ev]);
  }

  const todayUtc = new Date();
  const todayKey = `${todayUtc.getFullYear()}-${todayUtc.getMonth() + 1}-${todayUtc.getDate()}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="overflow-hidden rounded-lg border bg-card text-xs">

      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="font-semibold">{monthName}</h2>
        <div className="flex items-center gap-1">
          <Link
            href={`/app/events?m=${prevParam}`}
            className="rounded p-1.5 hover:bg-accent"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href={`/app/events?m=${nextParam}`}
            className="rounded p-1.5 hover:bg-accent"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </header>
      <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-xs font-medium text-muted-foreground">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="px-2 py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          const cellKey = day ? `${year}-${monthNum}-${day}` : null;
          const isToday = cellKey === todayKey;
          const dayEvents = day ? byDay.get(day) ?? [] : [];
          return (
            <div
              key={i}
              className={cn(
                'min-h-24 border-b border-r p-2 text-xs',
                i % 7 === 6 && 'border-r-0',
                !day && 'bg-muted/10',
              )}
            >
              {day ? (
                <>
                  <div
                    className={cn(
                      'mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                      isToday && 'bg-primary text-primary-foreground font-bold',
                    )}
                  >
                    {day}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map((e) => (
                      <Link
                        key={e.id}
                        href={`/app/events/${e.id}`}
                        className="block truncate rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary hover:bg-primary/20"
                        title={e.name}
                      >
                        {new Date(e.starts_at).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}{' '}
                        {e.name}
                      </Link>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
