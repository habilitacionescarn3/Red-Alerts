import { Outlet } from 'react-router-dom';
import { NavBar } from '@/components/shared/NavBar';

/**
 * App shell: a fixed navbar above a flex-1 content area. Pages decide their own
 * scrolling/footer (the map page is full-bleed; analytics scrolls with a footer).
 */
export function AppLayout() {
  return (
    <div className="flex h-svh min-h-svh flex-col overflow-hidden">
      <NavBar />
      <main className="relative min-h-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
