// client/src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import { navItems } from '../config/nav';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const items = navItems.filter((item) => !item.roles || item.roles.includes(user?.role));

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed z-40 inset-y-0 left-0 w-64 shrink-0 border-r border-border glass flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 lg:bg-surface2/40 lg:backdrop-blur-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 px-6 h-16 shrink-0">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-brand-red text-white font-bold text-sm">
            R
            <span className="absolute -bottom-1 -right-1 h-2.5 w-2.5 rounded-full bg-brand-yellow ring-2 ring-surface" />
          </span>
          <div className="leading-tight">
            <p className="font-semibold text-ink text-[15px]">Rekker</p>
            <p className="text-[11px] text-muted -mt-0.5">People &amp; HR</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onClose}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-red text-white shadow-sm shadow-brand-red/25'
                    : 'text-ink/80 hover:bg-surface2 hover:text-ink'
                }`
              }
            >
              <Icon size={17} strokeWidth={2} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-border">
          <p className="text-[11px] text-muted leading-relaxed">
            Rekker HR &middot; v1.0
            <br />
            Employee lifecycle, end to end.
          </p>
        </div>
      </aside>
    </>
  );
}
