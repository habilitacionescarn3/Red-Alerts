import AppRouter from '@/router';
import { ThemeProvider } from '@/components/theme-provider';
import { DirectionalToaster } from '@/components/shared/DirectionalToaster';
import { useLiveAlerts } from '@/lib/realtime';

/** Mounts the realtime (IoT) subscription / polling-fallback once for the app. */
function RealtimeBridge() {
  useLiveAlerts();
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <RealtimeBridge />
      <DirectionalToaster />
      <AppRouter />
    </ThemeProvider>
  );
}
