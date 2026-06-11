import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  formatIsraelClockParam,
  israelDateString,
  israelDateTime,
  israelMinutesFromMidnight,
  parseIsraelClockParam,
} from '@/lib/israelTime';
import { useTimelineStore } from '@/store/timelineStore';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Bidirectional sync between timeline store and ?date=&from=&to= query params.
 */
export function useTimelineUrlSync() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const hydrated = useRef(false);
  const skipWrite = useRef(false);

  const isOpen = useTimelineStore((s) => s.isOpen);
  const selectedDate = useTimelineStore((s) => s.selectedDate);
  const hasCustomRange = useTimelineStore((s) => s.hasCustomRange);
  const rangeStartMs = useTimelineStore((s) => s.rangeStartMs);
  const rangeEndMs = useTimelineStore((s) => s.rangeEndMs);
  const openTimeline = useTimelineStore((s) => s.openTimeline);
  const setSelectedDate = useTimelineStore((s) => s.setSelectedDate);
  const setRangeMs = useTimelineStore((s) => s.setRangeMs);

  // Hydrate store from URL once on mount.
  useEffect(() => {
    if (hydrated.current) return;

    const dateParam = searchParams.get('date');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    const hasTimelineParams =
      (dateParam && DATE_RE.test(dateParam)) || (fromParam && toParam && dateParam);

    if (hasTimelineParams) {
      skipWrite.current = true;
      openTimeline();

      if (dateParam && DATE_RE.test(dateParam)) {
        setSelectedDate(dateParam);
      }

      if (dateParam && fromParam && toParam) {
        const fromMin = parseIsraelClockParam(fromParam);
        const toMin = parseIsraelClockParam(toParam);
        if (fromMin !== null && toMin !== null) {
          const startMs = israelDateTime(dateParam, fromMin).getTime();
          const endMs = israelDateTime(dateParam, toMin).getTime();
          if (startMs <= endMs) {
            setRangeMs(startMs, endMs);
          }
        }
      }
    }

    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Write store state back to URL.
  useEffect(() => {
    if (!hydrated.current) return;
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.delete('date');
    params.delete('from');
    params.delete('to');

    const today = israelDateString();

    if (isOpen) {
      if (hasCustomRange) {
        params.set('date', selectedDate);
        params.set('from', formatIsraelClockParam(israelMinutesFromMidnight(new Date(rangeStartMs))));
        params.set('to', formatIsraelClockParam(israelMinutesFromMidnight(new Date(rangeEndMs))));
      } else if (selectedDate !== today) {
        params.set('date', selectedDate);
      }
    }

    // Canonicalize key order so this hook and useSelectedEventUrlSync (disjoint
    // params, same URL) always serialize to the same string and never ping-pong.
    params.sort();
    const next = params.toString();
    const canonicalCurrent = new URLSearchParams(searchParams);
    canonicalCurrent.sort();
    const current = canonicalCurrent.toString();
    if (next !== current) {
      navigate({ pathname: location.pathname, search: next ? `?${next}` : '' }, { replace: true });
    }
  }, [
    isOpen,
    hasCustomRange,
    selectedDate,
    rangeStartMs,
    rangeEndMs,
    navigate,
    location.pathname,
    searchParams,
  ]);
}
