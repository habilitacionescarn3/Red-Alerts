import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { StatCardProps } from '@/types/ui';

export function StatCard({ label, value, icon: Icon, accentClassName }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary',
            accentClassName,
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="truncate text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
