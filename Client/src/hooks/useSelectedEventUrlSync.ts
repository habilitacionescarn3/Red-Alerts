import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAlertsStore } from '@/store/alertsStore';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Bidirectional sync between the selected event and the ?event= query param,
 * so a selection can be shared as a deep link. Same hydrate-once +
 * write-back-replace pattern as `useTimelineUrlSync`; each hook deletes only
 * its own params, so both compose safely on the home page.
 *
 * A live broadcast auto-selects the new event, so the URL follows it - the
 * address bar always points at what the user is looking at.
 *
 * Returns the event id hydrated from the URL on mount (or null) so the page
 * can focus the map/feed once that event's data resolves.
 */
export function useSelectedEventUrlSync(): string | null {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const hydrated = useRef(false);
  const skipWrite = useRef(false);
  const [hydratedEventId, setHydratedEventId] = useState<string | null>(null);

  const selectedEventId = useAlertsStore((s) => s.selectedEventId);
  const selectEvent = useAlertsStore((s) => s.selectEvent);

  // Hydrate store from URL once on mount.
  useEffect(() => {
    if (hydrated.current) return;

    const eventParam = searchParams.get('event');
    if (eventParam && UUID_RE.test(eventParam)) {
      // Without this guard the write effect below would run before the store
      // update re-renders and delete the very param we just hydrated from.
      skipWrite.current = true;
      selectEvent(eventParam);
      setHydratedEventId(eventParam);
    }

    hydrated.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Write the selection back to the URL.
  useEffect(() => {
    if (!hydrated.current) return;
    if (skipWrite.current) {
      skipWrite.current = false;
      return;
    }

    const params = new URLSearchParams(searchParams);
    params.delete('event');
    if (selectedEventId) params.set('event', selectedEventId);

    // Canonicalize key order before comparing/writing. delete+set moves a key to
    // the end, so without this the timeline sync (which manages disjoint params)
    // and this hook would emit the same params in different orders and ping-pong
    // forever on every searchParams change.
    params.sort();
    const next = params.toString();
    const canonicalCurrent = new URLSearchParams(searchParams);
    canonicalCurrent.sort();
    const current = canonicalCurrent.toString();
    if (next !== current) {
      navigate({ pathname: location.pathname, search: next ? `?${next}` : '' }, { replace: true });
    }
  }, [selectedEventId, navigate, location.pathname, searchParams]);

  return hydratedEventId;
}
