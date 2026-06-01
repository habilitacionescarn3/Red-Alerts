import {
  Activity,
  FlaskConical,
  Plane,
  PlaneTakeoff,
  Radio,
  Rocket,
  Ship,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { AlertTypeIconName } from '@/types/alerts';
import type { AlertTypeIconProps } from '@/types/ui';
import { cn } from '@/lib/utils';

const ICONS: Record<AlertTypeIconName, LucideIcon> = {
  Rocket,
  TriangleAlert,
  Radio,
  Plane,
  PlaneTakeoff,
  FlaskConical,
  Users,
  Activity,
  Ship,
};

export function AlertTypeIcon({ icon, className }: AlertTypeIconProps) {
  const Icon = ICONS[icon] ?? TriangleAlert;
  return <Icon className={cn('h-4 w-4', className)} aria-hidden />;
}
