import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BasemapId } from '@/components/map/mapStyle';

interface BasemapState {
  basemap: BasemapId;
  setBasemap: (basemap: BasemapId) => void;
}

const VALID_BASEMAPS = new Set<BasemapId>(['dark', 'light', 'satellite']);

function normalizeBasemap(value: unknown): BasemapId {
  // 'auto'/'voyager' were removed; fall back to the default below.
  if (value === 'auto' || value === 'voyager') return 'satellite';
  if (typeof value === 'string' && VALID_BASEMAPS.has(value as BasemapId)) {
    return value as BasemapId;
  }
  return 'satellite';
}

export const useBasemapStore = create<BasemapState>()(
  persist(
    (set) => ({
      basemap: 'satellite',
      setBasemap: (basemap) => set({ basemap }),
    }),
    {
      name: 'red-alerts-basemap',
      merge: (persisted, current) => {
        const stored = persisted as Partial<BasemapState> | undefined;
        return {
          ...current,
          ...stored,
          basemap: normalizeBasemap(stored?.basemap),
        };
      },
    },
  ),
);
