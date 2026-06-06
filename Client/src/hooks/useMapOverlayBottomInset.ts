import { useTimelineStore } from '@/store/timelineStore';

/** Space reserved above the bottom edge for timeline panel or the History pill. */
const CLOSED_INSET_PX = 72;
const OPEN_GAP_PX = 12;

export function useMapOverlayBottomInset(): number {
  const isOpen = useTimelineStore((s) => s.isOpen);
  const panelHeightPx = useTimelineStore((s) => s.panelHeightPx);
  if (!isOpen) return CLOSED_INSET_PX;
  return panelHeightPx + OPEN_GAP_PX;
}
