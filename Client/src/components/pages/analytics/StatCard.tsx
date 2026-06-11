import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { StatCardProps } from '@/types/ui';

export function StatCard({ label, value, icon: Icon, accent = 'default' }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4 sm:gap-4 sm:p-5">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg sm:size-11',
            accent === 'destructive'
              ? 'bg-destructive/10 text-destructive'
              : 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-muted-foreground">{label}</p>
          <p className="truncate font-display text-2xl">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
