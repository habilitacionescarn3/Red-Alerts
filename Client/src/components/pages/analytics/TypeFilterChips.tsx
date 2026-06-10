import { useTranslation } from 'react-i18next';
import { ALERT_TYPES } from '@/data/alertTypes';
import { cn } from '@/lib/utils';
import { useAnalyticsFilterStore } from '@/store/analyticsFilterStore';
import type { AlertTypeCount } from '@/types/alerts';

const FALLBACK_COLOR = '#f97316';

interface TypeFilterChipsProps {
  /** Per-type counts of the currently visible window (city-filtered). */
  counts: AlertTypeCount[];
}

/** Toggleable alert-type chips (colored dot + localized label + count). */
export function TypeFilterChips({ counts }: TypeFilterChipsProps) {
  const { i18n } = useTranslation();
  const typeKeys = useAnalyticsFilterStore((s) => s.typeKeys);
  const toggleType = useAnalyticsFilterStore((s) => s.toggleType);
  const hebrew = i18n.language.startsWith('he');

  const countByKey = new Map(counts.map((c) => [c.key, c]));
  // Known types always show (count 0 included); data-only keys (unmapped
  // title prefixes) are appended with the label the data resolved to.
  const chips = Object.values(ALERT_TYPES).map((type) => ({
    key: type.key,
    label: hebrew ? type.labelHe : type.labelEn,
    color: type.color,
    count: countByKey.get(type.key)?.count ?? 0,
  }));
  for (const c of counts) {
    if (!chips.some((chip) => chip.key === c.key)) {
      chips.push({ key: c.key, label: c.label, color: c.color ?? FALLBACK_COLOR, count: c.count });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => {
        const selected = typeKeys.includes(chip.key);
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => toggleType(chip.key)}
            aria-pressed={selected}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
              selected
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <span className="size-2 rounded-full" style={{ backgroundColor: chip.color }} />
            <span>{chip.label}</span>
            <span className="tabular-nums opacity-70">{chip.count}</span>
          </button>
        );
      })}
    </div>
  );
}
