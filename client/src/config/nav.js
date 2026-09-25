// client/src/config/nav.js
import {
  LayoutGrid,
  Users,
  Clock,
  CalendarDays,
  Wallet,
  Target,
  UserSearch,
  ClipboardCheck,
  Laptop,
  GraduationCap,
  ShieldAlert,
  FolderLock,
  UserCog,
} from 'lucide-react';

export const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true, roles: ['admin', 'hr', 'director', 'manager', 'department_manager'] },
  { to: '/employees', label: 'Employees', icon: Users, roles: ['admin', 'hr', 'director', 'manager', 'department_manager'] },
  { to: '/attendance', label: 'Attendance', icon: Clock },
  { to: '/leave', label: 'Leave', icon: CalendarDays },
  { to: '/payroll', label: 'Payroll', icon: Wallet, roles: ['admin', 'hr', 'director'] },
  { to: '/performance', label: 'Performance', icon: Target },
  { to: '/recruitment', label: 'Recruitment', icon: UserSearch, roles: ['admin', 'hr', 'director', 'manager'] },
  { to: '/onboarding', label: 'Onboarding', icon: ClipboardCheck, roles: ['admin', 'hr', 'director', 'manager'] },
  { to: '/assets', label: 'Assets', icon: Laptop },
  { to: '/training', label: 'Training', icon: GraduationCap },
  { to: '/disciplinary', label: 'Disciplinary', icon: ShieldAlert, roles: ['admin', 'hr', 'director'] },
  { to: '/documents', label: 'Documents', icon: FolderLock },
  { to: '/users', label: 'User Accounts', icon: UserCog, roles: ['admin'] },
];

// A plain employee has no Dashboard (it's a company/department overview),
// so send them straight to something useful instead of a route that would
// just redirect them again.
export const getDefaultRoute = (role) => (role === 'employee' ? '/leave' : '/');
