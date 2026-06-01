import { create } from 'zustand';
import { israelDateString, israelDateTime } from '@/lib/israelTime';
import { MINUTES_PER_DAY } from '@/lib/time';

interface TimelineState {
  isOpen: boolean;
  selectedDate: string;
  /** User dragged the scrubber — map + feed both filter to this range. */
  hasCustomRange: boolean;
  rangeStartMs: number;
  rangeEndMs: number;
  openTimeline: () => void;
  closeTimeline: () => void;
  setSelectedDate: (date: string) => void;
  /** Enable custom range filtering (called when user drags scrubber). */
  setRangeMs: (startMs: number, endMs: number) => void;
  clearRange: () => void;
}

export const useTimelineStore = create<TimelineState>((set) => ({
  isOpen: false,
  selectedDate: israelDateString(),
  hasCustomRange: false,
  rangeStartMs: israelDateTime(israelDateString(), 0).getTime(),
  rangeEndMs: israelDateTime(israelDateString(), MINUTES_PER_DAY - 1).getTime(),

  openTimeline: () => set({ isOpen: true }),

  closeTimeline: () =>
    set({
      isOpen: false,
      hasCustomRange: false,
    }),

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
