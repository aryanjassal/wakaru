import { BookOpen, Library, Settings } from 'lucide-react';
import { NavLink } from 'react-router';
import { cn } from '@/renderer/src/lib/utils';

const ROUTES = [
  { to: '/mine', label: 'Mine', icon: BookOpen },
  { to: '/library', label: 'Library', icon: Library },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="flex flex-col gap-8 border-r border-border bg-card px-4 py-6 max-md:border-r-0 max-md:border-b">
      <div className="px-2">
        <h1 className="text-2xl font-semibold leading-none">Wakaru</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Japanese word mining
        </p>
      </div>
      <nav className="grid gap-1 max-md:grid-cols-3">
        {ROUTES.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                isActive &&
                  'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground'
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
