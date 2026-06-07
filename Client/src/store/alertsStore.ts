import { create } from 'zustand';
import type { AlertBroadcast, AlertEvent, LngLat } from '@/types/alerts';
import type { ConnectionStatus, FocusRequest } from '@/types/alerts';
import { CONFIG } from '@/data/config';

interface AlertsState {
  /** Newest-first ring buffer of events pushed over the realtime channel. */
  liveEvents: AlertEvent[];
  /** City id -> points, accumulated from realtime broadcasts (joined with the
   *  query's `cities` to draw events that arrived live, before the next refetch). */
  liveCityCoords: Record<string, LngLat[] | null>;
  connection: ConnectionStatus;
  /** The most recent broadcast (drives the new-alert toast + sound). */
  lastBroadcast: AlertBroadcast | null;
  selectedEventId: string | null;
  focusRequest: FocusRequest | null;

  ingestBroadcast: (broadcast: AlertBroadcast) => void;
  setConnection: (status: ConnectionStatus) => void;
  selectEvent: (eventId: string | null) => void;
  requestFocus: (area: string, eventId: string) => void;
  clearLive: () => void;
}

export const useAlertsStore = create<AlertsState>((set) => ({
  liveEvents: [],
  liveCityCoords: {},
  connection: 'idle',
  lastBroadcast: null,
  selectedEventId: null,
  focusRequest: null,

  ingestBroadcast: (broadcast) =>
    set((state) => {
      const event = broadcast.event;
      const deduped = state.liveEvents.filter((e) => e.id !== event.id);
      const liveEvents = [event, ...deduped].slice(0, CONFIG.LIVE_BUFFER_SIZE);
      // Broadcasts carry no city data (stripped to keep IoT payloads small and
      // consistent). Cities + coordinates arrive via the HTTP refetch that
      // invalidateTodayAlerts triggers immediately after this runs.
      return {
        liveEvents,
        liveCityCoords: state.liveCityCoords,
        lastBroadcast: broadcast,
        selectedEventId: event.id,
        focusRequest: state.focusRequest,
      };
    }),

  setConnection: (status) => set({ connection: status }),

  selectEvent: (eventId) => set({ selectedEventId: eventId }),

  requestFocus: (area, eventId) =>
    set({ focusRequest: { area, eventId, ts: Date.now() }, selectedEventId: eventId }),

  clearLive: () => set({ liveEvents: [], liveCityCoords: {}, lastBroadcast: null }),
}));
