import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface MapZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

/** Theme-aware zoom buttons using logical start positioning (RTL-safe). */
export function MapZoomControls({ onZoomIn, onZoomOut }: MapZoomControlsProps) {
  const { t } = useTranslation();

  return (
    <div className="pointer-events-none absolute start-3 top-3 z-10 sm:start-4 sm:top-4">
      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-md border bg-card shadow-md">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-none"
          aria-label={t('map.zoomIn')}
          onClick={onZoomIn}
        >
          <Plus className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-none border-t"
          aria-label={t('map.zoomOut')}
          onClick={onZoomOut}
        >
          <Minus className="size-4" />
        </Button>
      </div>
    </div>
  );
}
