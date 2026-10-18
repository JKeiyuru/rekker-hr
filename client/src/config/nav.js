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
  Receipt,
  ThumbsUp,
  UserCircle,
  Link2,
} from 'lucide-react';

// The sidebar is split into sections that follow how HR work flows: the
// company at a glance, then the people (hire -> onboard -> manage -> develop ->
// discipline), their time and leave, pay, company property, system
// administration, and finally each person's own account.
export const navGroups = [
  { key: 'overview', label: '' },
  { key: 'people', label: 'People' },
  { key: 'time', label: 'Time & Leave' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'company', label: 'Company' },
  { key: 'admin', label: 'Administration' },
  { key: 'me', label: 'My Account' },
];

export const navItems = [
  { group: 'overview', to: '/', label: 'Dashboard', icon: LayoutGrid, end: true, roles: ['admin', 'hr', 'director', 'manager', 'department_manager'] },

  { group: 'people', to: '/employees', label: 'Employees', icon: Users, roles: ['admin', 'hr', 'director', 'manager', 'department_manager'] },
  { group: 'people', to: '/recruitment', label: 'Recruitment', icon: UserSearch, roles: ['admin', 'hr', 'director', 'manager'] },
  { group: 'people', to: '/onboarding', label: 'Onboarding', icon: ClipboardCheck, roles: ['admin', 'hr', 'director', 'manager'] },
  { group: 'people', to: '/performance', label: 'Performance', icon: Target },
  { group: 'people', to: '/training', label: 'Training', icon: GraduationCap },
  { group: 'people', to: '/documents', label: 'Documents', icon: FolderLock },
  { group: 'people', to: '/disciplinary', label: 'Disciplinary', icon: ShieldAlert, roles: ['admin', 'hr', 'director'] },

  { group: 'time', to: '/attendance', label: 'Attendance', icon: Clock },
  { group: 'time', to: '/leave', label: 'Leave', icon: CalendarDays },
  // Only for people an admin has given leave-recommending rights
  { group: 'time', to: '/leave-recommendations', label: 'Recommend Leave', icon: ThumbsUp, show: (user) => user?.recommendDepartments?.length > 0 },

  { group: 'payroll', to: '/payroll', label: 'Payroll', icon: Wallet, roles: ['admin', 'accountant', 'hr', 'director'] },
  { group: 'payroll', to: '/payroll-links', label: 'Payroll Links', icon: Link2, roles: ['admin'] },

  { group: 'company', to: '/assets', label: 'Assets', icon: Laptop },

  { group: 'admin', to: '/users', label: 'User Accounts', icon: UserCog, roles: ['admin'] },

  { group: 'me', to: '/payslips', label: 'My Payslips', icon: Receipt },
  { group: 'me', to: '/profile', label: 'My Profile', icon: UserCircle, show: (user) => !!user?.employee },
];

// A plain employee has no Dashboard (it's a company/department overview),
// so send them straight to something useful instead of a route that would
// just redirect them again.
export const getDefaultRoute = (role) => (role === 'employee' ? '/leave' : role === 'accountant' ? '/payroll' : '/');
