import { create } from 'zustand';
import { CONFIG } from '@/data/config';
import { israelDateString, shiftIsraelDate } from '@/lib/israelTime';
import type { AnalyticsRange, AnalyticsRangePreset } from '@/types/alerts';

/**
 * Analytics page filters. Deliberately decoupled from the HomePage timeline
 * store - the two pages browse time independently.
 *
 * `cityNames` holds RAW Hebrew names exactly as events carry them; localized
 * names are display-only and must never be stored here (see useLocalizeCityName).
 */
interface AnalyticsFilterState {
  preset: AnalyticsRangePreset;
  /** Custom range bounds (Israel-local YYYY-MM-DD); only used when preset === 'custom'. */
  customFrom: string | null;
  customTo: string | null;
  cityNames: string[];
  typeKeys: string[];
  setPreset: (preset: Exclude<AnalyticsRangePreset, 'custom'>) => void;
  setCustomRange: (from: string, to: string) => void;
  toggleCity: (name: string) => void;
  setCities: (names: string[]) => void;
  toggleType: (key: string) => void;
  setTypes: (keys: string[]) => void;
  clearCities: () => void;
  clearFilters: () => void;
}

/** Order the pair, forbid future days, and cap the span at RANGE_MAX_DAYS. */
export function clampCustomRange(from: string, to: string): { from: string; to: string } {
  const today = israelDateString();
  let start = from <= to ? from : to;
  let end = from <= to ? to : from;
  if (end > today) end = today;
  if (start > end) start = end;
  const earliest = shiftIsraelDate(end, -(CONFIG.RANGE_MAX_DAYS - 1));
  if (start < earliest) start = earliest;
  return { from: start, to: end };
}

/** The concrete window a preset stands for, computed against Israel "today". */
export function resolveAnalyticsRange(
  state: Pick<AnalyticsFilterState, 'preset' | 'customFrom' | 'customTo'>,
): AnalyticsRange {
  const today = israelDateString();
  switch (state.preset) {
    case '24h':
      return { mode: 'rolling24h' };
    case '7d':
      return { mode: 'range', fromDate: shiftIsraelDate(today, -6), toDate: today };
    case '30d':
      return { mode: 'range', fromDate: shiftIsraelDate(today, -29), toDate: today };
    case 'custom': {
      if (!state.customFrom || !state.customTo) return { mode: 'rolling24h' };
      const { from, to } = clampCustomRange(state.customFrom, state.customTo);
      return { mode: 'range', fromDate: from, toDate: to };
    }
  }
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

export const useAnalyticsFilterStore = create<AnalyticsFilterState>((set) => ({
  preset: '24h',
  customFrom: null,
  customTo: null,
  cityNames: [],
  typeKeys: [],

  setPreset: (preset) => set({ preset }),

  setCustomRange: (from, to) => {
    const clamped = clampCustomRange(from, to);
    set({ preset: 'custom', customFrom: clamped.from, customTo: clamped.to });
  },

  toggleCity: (name) => set((s) => ({ cityNames: toggleValue(s.cityNames, name) })),

  setCities: (names) => set({ cityNames: names }),

  toggleType: (key) => set((s) => ({ typeKeys: toggleValue(s.typeKeys, key) })),

  setTypes: (keys) => set({ typeKeys: keys }),

  clearCities: () => set({ cityNames: [] }),

  clearFilters: () => set({ cityNames: [], typeKeys: [] }),
}));
