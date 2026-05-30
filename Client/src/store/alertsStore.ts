import { create } from 'zustand';
import type { AlertBroadcast, AlertEvent } from '@/types/alerts';
import { CONFIG } from '@/data/config';

/** Realtime channel status, surfaced in the navbar live indicator. */
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'polling' | 'offline';

/** A request for the map to fly to / highlight a specific area. */
export interface FocusRequest {
  area: string;
  eventId: string;
  /** Monotonic timestamp so repeated focuses on the same area still trigger. */
  ts: number;
}

interface AlertsState {
  /** Newest-first ring buffer of events pushed over the realtime channel. */
  liveEvents: AlertEvent[];
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
  connection: 'idle',
  lastBroadcast: null,
  selectedEventId: null,
  focusRequest: null,

  ingestBroadcast: (broadcast) =>
    set((state) => {
      const event = broadcast.event;
      const deduped = state.liveEvents.filter((e) => e.id !== event.id);
      const liveEvents = [event, ...deduped].slice(0, CONFIG.LIVE_BUFFER_SIZE);
      const firstCity = event.cities[0]?.name;
      return {
        liveEvents,
        lastBroadcast: broadcast,
        selectedEventId: event.id,
        focusRequest: firstCity
          ? { area: firstCity, eventId: event.id, ts: Date.now() }
          : state.focusRequest,
      };
    }),

  setConnection: (status) => set({ connection: status }),

  selectEvent: (eventId) => set({ selectedEventId: eventId }),

  requestFocus: (area, eventId) =>
    set({ focusRequest: { area, eventId, ts: Date.now() }, selectedEventId: eventId }),

  clearLive: () => set({ liveEvents: [], lastBroadcast: null }),
}));
