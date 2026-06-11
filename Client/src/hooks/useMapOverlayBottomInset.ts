import { useTimelineStore } from '@/store/timelineStore';

/** Space reserved above the bottom edge for timeline panel or the History pill. */
const CLOSED_INSET_PX = 72;
const OPEN_GAP_PX = 12;

/** Bottom inset of the mobile control row when nothing else demands space. */
export const BASE_INSET_PX = 16;
/** Extra clearance so MapLibre popups near the bottom stay visible. */
export const SELECTED_POPUP_CLEARANCE_PX = 56;
/** Height of one floating control row (lg button 40px + 8px gap). */
export const CONTROL_ROW_PX = 48;

export function useMapOverlayBottomInset(): number {
  const isOpen = useTimelineStore((s) => s.isOpen);
  const panelHeightPx = useTimelineStore((s) => s.panelHeightPx);
  if (!isOpen) return CLOSED_INSET_PX;
  return panelHeightPx + OPEN_GAP_PX;
}
