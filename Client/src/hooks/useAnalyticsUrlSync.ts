import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ALERT_TYPES } from '@/data/alertTypes';
import { useAnalyticsFilterStore } from '@/store/analyticsFilterStore';
import type { AnalyticsRangePreset } from '@/types/alerts';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRESET_PARAMS: AnalyticsRangePreset[] = ['24h', '7d', '30d', 'custom'];
const MAX_URL_CITIES = 50;

const KNOWN_TYPE_KEYS = new Set([
  ...Object.values(ALERT_TYPES).map((t) => t.key),
  'unmapped',
  'unknown',
]);

/**
 * Bidirectional sync between the analytics filter store and
 * ?range=&from=&to=&types=&cities= so filtered views are shareable URLs.
 * Same hydrate-once / write-back pattern as useTimelineUrlSync (HomePage).
 */
export function useAnalyticsUrlSync() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const hydrated = useRef(false);
  const skipWrite = useRef(false);

  const preset = useAnalyticsFilterStore((s) => s.preset);
  const customFrom = useAnalyticsFilterStore((s) => s.customFrom);
  const customTo = useAnalyticsFilterStore((s) => s.customTo);
  const cityNames = useAnalyticsFilterStore((s) => s.cityNames);
  const typeKeys = useAnalyticsFilterStore((s) => s.typeKeys);
  const setPreset = useAnalyticsFilterStore((s) => s.setPreset);
  const setCustomRange = useAnalyticsFilterStore((s) => s.setCustomRange);
  const setCities = useAnalyticsFilterStore((s) => s.setCities);
  const setTypes = useAnalyticsFilterStore((s) => s.setTypes);

  // Hydrate store from URL once on mount.
  useEffect(() => {
    if (hydrated.current) return;

    const rangeParam = searchParams.get('range');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');
    const typesParam = searchParams.get('types');
    const citiesParam = searchParams.get('cities');

    let touched = false;

    if (rangeParam && PRESET_PARAMS.includes(rangeParam as AnalyticsRangePreset)) {
      if (
        rangeParam === 'custom' &&
        fromParam &&
        toParam &&
        DATE_RE.test(fromParam) &&
        DATE_RE.test(toParam)
      ) {
        setCustomRange(fromParam, toParam); // store clamps span + future dates
        touched = true;
      } else if (rangeParam !== 'custom') {
        setPreset(rangeParam as Exclude<AnalyticsRangePreset, 'custom'>);
        touched = true;
      }
    }

    if (typesParam) {
      const keys = typesParam
        .split(',')
        .map((k) => k.trim())
        .filter((k) => KNOWN_TYPE_KEYS.has(k));
      if (keys.length) {
        setTypes(Array.from(new Set(keys)));
        touched = true;
      }
    }

    if (citiesParam) {
      const names = citiesParam
        .split('|')
        .map((n) => n.trim())
        .filter(Boolean)
        .slice(0, MAX_URL_CITIES);
      if (names.length) {
        setCities(Array.from(new Set(names)));
        touched = true;
      }
    }

    if (touched) skipWrite.current = true;
    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Write store state back to URL (params omitted at their defaults).
  useEffect(() => {
    if (!hydrated.current) return;
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.delete('range');
    params.delete('from');
    params.delete('to');
    params.delete('types');
    params.delete('cities');

    if (preset !== '24h') params.set('range', preset);
    if (preset === 'custom' && customFrom && customTo) {
      params.set('from', customFrom);
      params.set('to', customTo);
    }
    if (typeKeys.length) params.set('types', typeKeys.join(','));
    if (cityNames.length) params.set('cities', cityNames.join('|'));

    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      navigate({ pathname: location.pathname, search: next ? `?${next}` : '' }, { replace: true });
    }
  }, [
    preset,
    customFrom,
    customTo,
    cityNames,
    typeKeys,
    navigate,
    location.pathname,
    searchParams,
  ]);
}
