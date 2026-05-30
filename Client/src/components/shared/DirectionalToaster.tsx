import { useTranslation } from 'react-i18next';
import { Toaster } from '@/components/ui/sonner';
import { isRTL } from '@/i18n/config';

export function DirectionalToaster() {
  const { i18n } = useTranslation();
  const position = isRTL(i18n.language) ? 'bottom-left' : 'bottom-right';
  const dir = isRTL(i18n.language) ? 'rtl' : 'ltr';

  return <Toaster position={position} dir={dir} richColors closeButton />;
}
