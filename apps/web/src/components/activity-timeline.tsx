import { formatDistanceToNow } from 'date-fns';
import { Calendar, Mail, MessageSquare, Phone, StickyNote, UserCheck, Clock } from 'lucide-react';

const iconMap: Record<string, typeof Mail> = {
  note: StickyNote,
  call: Phone,
  email: Mail,
  meeting: UserCheck,
  task: Clock,
  sms: MessageSquare,
  event_log: Calendar,
};

type Activity = {
  id: string;
  type: string;
  subject: string | null;
  body: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (!activities.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No activity yet. Log your first note, call, or email above.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {activities.map((a) => {
        const Icon = iconMap[a.type] ?? StickyNote;
        return (
          <li key={a.id} className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <div className="text-sm font-medium capitalize">{a.type.replace('_', ' ')}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                </div>
              </div>
              {a.subject ? <div className="mt-0.5 text-sm">{a.subject}</div> : null}
              {a.body ? (
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{a.body}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
