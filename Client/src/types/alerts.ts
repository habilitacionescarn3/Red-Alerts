/**
 * Frontend mirror of the backend `Event.to_dict()` contract.
 * Source of truth: Server/layer/python/codebase/models/event.py.
 */

export interface AlertCategory {
  id: string;
  code: string;
  label: string | null;
}

export interface AlertText {
  id: string;
  text: string;
}

export interface AlertCity {
  id: string;
  name: string;
}

/** One logical alert episode (NOT one raw Oref id). */
export interface AlertEvent {
  id: string;
  oref_id: string;
  /** ISO-8601 UTC string for when the episode started. */
  received_at: string | null;
  /** ISO-8601 UTC string for the last update absorbed into the episode. */
  last_seen_at: string | null;
  category: AlertCategory | null;
  title: AlertText | null;
  description: AlertText | null;
  cities: AlertCity[];
}

/**
 * Payload broadcast on the IoT topic by the worker.
 * Source of truth: Server/layer/python/codebase/controllers/events_controller.py.
 */
export interface AlertBroadcast {
  status: 'created' | 'updated';
  added_cities: string[];
  event: AlertEvent;
}
