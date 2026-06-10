import { useTranslation } from 'react-i18next';

interface HeatLegendProps {
  /** Highest per-city event count in the current window. */
  max: number;
}

/** Gradient legend for the heat map (numeric scale stays LTR in Hebrew too). */
export function HeatLegend({ max }: HeatLegendProps) {
  const { t } = useTranslation();
  if (max <= 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-3 start-3 z-10 rounded-md border bg-card/85 px-2.5 py-1.5 shadow-sm backdrop-blur">
      <p className="mb-1 text-[10px] font-medium text-muted-foreground">
        {t('analytics.heatmap.legend')}
      </p>
      <div dir="ltr" className="flex items-center gap-1.5">
        <span className="text-[10px] tabular-nums text-muted-foreground">0</span>
        <span
          className="h-2 w-24 rounded-full"
          style={{ background: 'linear-gradient(to right, #22c55e, #eab308, #ef4444)' }}
        />
        <span className="text-[10px] tabular-nums text-muted-foreground">{max}</span>
      </div>
    </div>
  );
}
