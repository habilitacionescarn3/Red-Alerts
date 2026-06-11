import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/ui/chip';
import { ALERT_TYPES } from '@/data/alertTypes';
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
    // Below sm the chips become ONE horizontally-scrollable row so the sticky
    // filter strip stays short on phones.
    <div className="flex items-center gap-1.5 max-sm:w-full max-sm:overflow-x-auto max-sm:pb-0.5 max-sm:[scrollbar-width:none] sm:flex-wrap">
      {chips.map((chip) => (
        <Chip
          key={chip.key}
          selected={typeKeys.includes(chip.key)}
          swatch={chip.color}
          onClick={() => toggleType(chip.key)}
        >
          <span>{chip.label}</span>
          <span className="tabular-nums opacity-70">{chip.count}</span>
        </Chip>
      ))}
    </div>
  );
}
