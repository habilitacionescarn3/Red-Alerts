import {
  Activity,
  FlaskConical,
  Plane,
  Radio,
  Rocket,
  Ship,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { categoryMeta } from '@/data/categories';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  Rocket,
  TriangleAlert,
  Radio,
  Plane,
  FlaskConical,
  Users,
  Activity,
  Ship,
};

export interface CategoryIconProps {
  code: string | null | undefined;
  className?: string;
}

export function CategoryIcon({ code, className }: CategoryIconProps) {
  const meta = categoryMeta(code);
  const Icon = ICONS[meta.icon] ?? TriangleAlert;
  return <Icon className={cn('h-4 w-4', className)} aria-hidden />;
}
