import type { LucideIcon } from 'lucide-react';
import type {
  AlertEvent,
  AlertTypeIconName,
  CityFeatureCollection,
  LngLat,
  MapCityMeta,
  PreviewCity,
} from '@/types/alerts';

export interface AlertFeedProps {
  events: AlertEvent[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  feedTitle: string;
  feedSubtitle: string;
  feedEmpty: string;
}

export interface AlertFeedItemProps {
  event: AlertEvent;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (event: AlertEvent) => void;
}

export interface ActiveAlertsBannerProps {
  activeCount: number;
}

export interface DayScrubberProps {
  dayEvents: AlertEvent[];
}

export interface TimelineBarProps {
  dayEvents: AlertEvent[];
}

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  /** Icon badge tint; 'destructive' marks the live/active stat. */
  accent?: 'default' | 'destructive';
}

export interface PageMetadataProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  canonicalPath?: string;
  noIndex?: boolean;
}

export interface AlertTypeIconProps {
  icon: AlertTypeIconName;
  className?: string;
}

export interface AlertMapProps {
  featureCollection: CityFeatureCollection;
  activeKeys: string[];
  recentKeys: string[];
  selectedKeys: string[];
  cityMeta: Record<string, MapCityMeta>;
  onSelectEvent: (eventId: string) => void;
}

export interface GeoPreviewMapProps {
  current: LngLat[] | null;
  candidate: LngLat[] | null;
  allCities?: PreviewCity[] | null;
}
