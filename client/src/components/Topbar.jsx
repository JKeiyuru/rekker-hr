// client/src/components/Topbar.jsx
import { useState } from 'react';
import { Menu, Moon, Sun, LogOut, ChevronDown } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import Avatar from './Avatar';

export default function Topbar({ onMenuClick }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 glass border-b border-border">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <button
          onClick={onMenuClick}
          className="focus-ring rounded-full p-2 text-ink hover:bg-surface2 lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div className="hidden lg:block" />

        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="focus-ring relative h-9 w-9 rounded-full text-ink hover:bg-surface2 flex items-center justify-center transition-colors"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="focus-ring flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 hover:bg-surface2 transition-colors"
            >
              <Avatar name={user?.name} size="sm" />
              <span className="hidden sm:block text-sm font-medium text-ink">
                {user?.name?.split(' ')[0]}
              </span>
              <ChevronDown size={14} className="text-muted hidden sm:block" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-11 z-20 w-52 card p-1.5 shadow-floating animate-riseIn">
                  <div className="px-3 py-2">
                    <p className="text-sm font-medium text-ink truncate">{user?.name}</p>
                    <p className="text-xs text-muted truncate">{user?.email}</p>
                    <p className="text-xs text-brand-red capitalize mt-0.5 font-medium">{user?.role}</p>
                  </div>
                  <div className="h-px bg-border my-1" />
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-brand-red hover:bg-brand-red/10"
                  >
                    <LogOut size={15} /> Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
