import { create } from 'zustand';
import { israelDateString, israelDateTime } from '@/lib/israelTime';
import { MINUTES_PER_DAY } from '@/lib/time';

interface TimelineState {
  isOpen: boolean;
  /** Measured height of the open timeline panel (px). 0 when closed. */
  panelHeightPx: number;
  selectedDate: string;
  /** User dragged the scrubber — map + feed both filter to this range. */
  hasCustomRange: boolean;
  rangeStartMs: number;
  rangeEndMs: number;
  openTimeline: () => void;
  closeTimeline: () => void;
  setPanelHeightPx: (height: number) => void;
  setSelectedDate: (date: string) => void;
  /** Enable custom range filtering (called when user drags scrubber). */
  setRangeMs: (startMs: number, endMs: number) => void;
  clearRange: () => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  isOpen: false,
  panelHeightPx: 0,
  selectedDate: israelDateString(),
  hasCustomRange: false,
  rangeStartMs: israelDateTime(israelDateString(), 0).getTime(),
  rangeEndMs: israelDateTime(israelDateString(), MINUTES_PER_DAY - 1).getTime(),

  openTimeline: () => set({ isOpen: true }),

  closeTimeline: () =>
    set({
      isOpen: false,
      hasCustomRange: false,
      panelHeightPx: 0,
    }),

  setPanelHeightPx: (panelHeightPx) => set({ panelHeightPx }),

  setSelectedDate: (date) =>
    set({
      selectedDate: date,
      hasCustomRange: false,
    }),

  setRangeMs: (startMs, endMs) =>
    set({
      rangeStartMs: startMs,
      rangeEndMs: endMs,
      hasCustomRange: true,
    }),

  clearRange: () =>
    set({
      hasCustomRange: false,
    }),
}));
