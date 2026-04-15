import Link from 'next/link';
import { cn } from '@/lib/utils';

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  rowHref,
  emptyState,
}: {
  rows: T[];
  columns: Column<T>[];
  rowHref?: (row: T) => string;
  emptyState?: React.ReactNode;
}) {
  if (!rows.length && emptyState) return <>{emptyState}</>;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  'px-4 py-3 text-left font-medium text-muted-foreground',
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = rowHref?.(row);
            return (
              <tr
                key={row.id}
                className={cn(
                  'border-t',
                  href && 'cursor-pointer transition-colors hover:bg-muted/40',
                )}
              >
                {columns.map((c) => {
                  const content = (
                    <div className={cn('px-4 py-3', c.className)}>{c.render(row)}</div>
                  );
                  return (
                    <td key={c.key} className="p-0 align-middle">
                      {href ? (
                        <Link href={href} className="block">
                          {content}
                        </Link>
                      ) : (
                        content
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
