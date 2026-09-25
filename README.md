# Rekker HR

A full employee lifecycle system built for Rekker — from recruitment through
onboarding, day-to-day HR operations, and eventually offboarding.

Built on the **MERN** stack (MongoDB, Express, React, Node), styled with an
Apple-inspired UI in Rekker's brand colours (red, white, a little yellow and
green), with full light and dark themes.

👉 **First time here? See [SETUP.md](./SETUP.md) for step-by-step Windows /
PowerShell / VS Code setup instructions.**

## Modules

1. **Employee records** — profiles, department/role/branch, employment type,
   reporting manager, emergency contact, next of kin, contract status.
2. **Attendance** — check-in/out, lateness, absence, daily & summary views.
3. **Leave** — applications, manager approval, balances (annual, sick,
   maternity/paternity, unpaid), approval history.
4. **Payroll support** — basic salary, allowances, deductions, overtime,
   bonuses, advances, and Excel export per pay period (not a full payroll
   replacement — designed to hand off to one).
5. **Performance management** — KPIs/goals, monthly/quarterly reviews,
   manager ratings, improvement plans, recognition.
6. **Recruitment** — job openings, applicants, interview stages, shortlisting,
   one-click conversion of a hired applicant into a full employee record.
7. **Onboarding** — auto-created checklist the moment someone is hired
   (contract signed, documents received, account created, assets issued,
   introduction, department & manager assigned).
8. **Employee assets** — laptops, phones, SIM cards, uniforms, ID cards,
   vehicles, tools — with an asset return checklist for exits.
9. **Training** — programs, attendance, certifications & expiry tracking,
   costs, skills covered.
10. **Disciplinary / HR cases** — warnings, incidents, explanations, actions
    taken, confidential notes — restricted to Admin & HR roles only.
11. **Documents** — central repository (contracts, IDs, certificates, warning
    letters, payslips, policies) with expiry reminders.
12. **HR dashboard** — headcount, active/on-leave/suspended/exited, contracts
    expiring soon, late-today, pending leave requests, performance reviews
    due, assets awaiting sign-off — all live from the database.

## Tech stack

- **Backend:** Node.js, Express, MongoDB (Mongoose), JWT auth with
  role-based access control (`admin`, `hr`, `manager`, `employee`),
  Multer for file uploads, ExcelJS for payroll exports.
- **Frontend:** React 18 (Vite), React Router, Tailwind CSS, Recharts for
  dashboard charts, `lucide-react` icons, `react-hot-toast` notifications.
- **Design:** Apple-style glass surfaces, rounded cards, light & dark themes
  driven by CSS variables, Rekker brand palette (red / white / yellow / green)
  used semantically (red = primary actions & alerts, green = positive/active,
  yellow = attention/in-progress).

## Project structure

```
rekker-hr/
├── server/            Express + MongoDB API
│   ├── config/        Database connection
│   ├── controllers/   Business logic per module
│   ├── middleware/     Auth, error handling, file uploads
│   ├── models/         Mongoose schemas (one per module)
│   ├── routes/         Express routers, wired to controllers
│   ├── utils/          JWT helper + database seed script
│   └── server.js       App entry point
├── client/            React (Vite) app
│   └── src/
│       ├── api/         Axios instance with auth interceptor
│       ├── components/  Shared UI (Sidebar, Drawer, DataTable, etc.)
│       ├── context/      Auth + theme providers
│       ├── hooks/        Shared data-fetching hooks
│       └── pages/        One page per module
├── SETUP.md           Step-by-step setup guide (Windows/PowerShell)
└── README.md          This file
```

## Roles & permissions (at a glance)

The system now enforces **data scoping**, not just feature-hiding: every
GET/POST/PUT/DELETE is filtered server-side by who's asking, so an
`employee` account can never see another employee's records even by calling
the API directly.

| Role                 | Sees | Can create/manage |
|----------------------|------|--------------------|
| `admin`              | Everything, every department | Everything, incl. user accounts |
| `director`           | Everything, every department | Everything except user accounts |
| `hr`                 | Everything, every department | Everything except user accounts |
| `manager` ("general manager") | Everything, every department | Employees (view), attendance, leave approvals, recruitment, onboarding, performance, assets, training, documents — **not** payroll or disciplinary cases |
| `department_manager` | Only employees in their own department (matched via their linked employee record's `department` field) | Same modules as `manager`, but scoped to their own department only |
| `employee`           | Only their own records | Their own check-in/out, leave applications, and document uploads (edits to an existing document create a pending revision — see below) |

Disciplinary cases and payroll are restricted to `admin`, `hr` and
`director` at the API route level — not just hidden in the UI.

### Document edit/approval workflow

An employee can upload their own documents freely. If they **replace** an
existing one, the old version stays the current/active one and the new
upload sits as "Pending Review" until a department manager, manager, HR or
admin approves it (or rejects it, in which case the original is untouched).
Nobody — not even the document's own owner — can delete a document; only
`admin`/`hr` can.

### Demo logins (from `npm run seed`)

| Role | Email | Password |
|------|-------|----------|
| Employee | jane.wanjiru@rekker.co.ke | Employee@2026 |
| Department Manager (Merchandising) | peter.kamau@rekker.co.ke | Manager@2026 |
| Manager (company-wide) | grace.mwangi@rekker.co.ke | Manager@2026 |
| Director | david.kiptoo@rekker.co.ke | Director@2026 |
| Admin (super admin) | admin@rekker.co.ke | Rekker@2026 |

Log in as each to see exactly what that role sees. Re-run `npm run seed`
any time — it only creates records that don't already exist, so it's safe
to run again after you've added your own real data.
