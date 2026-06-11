import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { HEAT_RAMP_GRADIENT } from '@/lib/geo/heat';

interface HeatLegendProps {
  /** Highest per-city event count in the current window. */
  max: number;
}

/** Gradient legend for the heat map (numeric scale stays LTR in Hebrew too). */
export function HeatLegend({ max }: HeatLegendProps) {
  const { t } = useTranslation();
  if (max <= 0) return null;

  return (
    <Card
      variant="overlay"
      size="xs"
      className="pointer-events-none absolute bottom-3 start-3 z-10 gap-1 px-2.5 py-1.5"
    >
      <p className="text-2xs font-medium text-muted-foreground">
        {t('analytics.heatmap.legend')}
      </p>
      <div dir="ltr" className="flex items-center gap-1.5">
        <span className="font-mono text-2xs tabular-nums text-muted-foreground">0</span>
        <span className="h-2 w-24 rounded-full" style={{ background: HEAT_RAMP_GRADIENT }} />
        <span className="font-mono text-2xs tabular-nums text-muted-foreground">{max}</span>
      </div>
    </Card>
  );
}
