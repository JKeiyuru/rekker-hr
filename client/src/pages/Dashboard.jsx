// client/src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import api from '../api/axios';
import StatCard from '../components/StatCard';
import { Spinner } from '../components/Feedback';
import {
  Users,
  CheckCircle2,
  Palmtree,
  FileWarning,
  Clock,
  ClipboardList,
  Star,
  Laptop,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    api
      .get('/dashboard')
      .then((res) => setStats(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!stats) return null;

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? 'Good morning' : greetingHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          {greeting}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="text-sm text-muted mt-1">Here's what's happening across Rekker today.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Employees" value={stats.totalEmployees} icon={Users} tone="neutral" />
        <StatCard
          label="Active"
          value={stats.activeEmployees}
          icon={CheckCircle2}
          tone="green"
          hint={`${stats.suspendedEmployees} suspended · ${stats.exitedEmployees} exited`}
        />
        <StatCard label="On Leave" value={stats.onLeaveEmployees} icon={Palmtree} tone="yellow" />
        <StatCard
          label="Contracts Expiring"
          value={stats.contractsExpiringSoon}
          icon={FileWarning}
          tone="red"
          hint="Within 30 days"
        />
        <StatCard
          label="Late Today"
          value={stats.lateToday}
          icon={Clock}
          tone="yellow"
          hint={`${stats.presentToday} present · ${stats.absentToday} absent`}
        />
        <StatCard label="Leave Requests Pending" value={stats.pendingLeaveRequests} icon={ClipboardList} tone="red" />
        <StatCard label="Performance Reviews Due" value={stats.performanceDue} icon={Star} tone="yellow" />
        <StatCard label="Assets Awaiting Sign-off" value={stats.assetsAwaitingReturn} icon={Laptop} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mt-6">
        <div className="card p-6 lg:col-span-3">
          <h3 className="font-semibold text-ink mb-1">Headcount by department</h3>
          <p className="text-sm text-muted mb-4">Active employees only</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.departmentBreakdown.map((d) => ({ name: d._id || 'Unassigned', count: d.count }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-border" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="currentColor" className="text-muted" />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid rgb(var(--color-border))',
                    background: 'rgb(var(--color-surface))',
                    color: 'rgb(var(--color-text))',
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="count" fill="#D60821" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6 lg:col-span-2">
          <h3 className="font-semibold text-ink mb-4">Workforce status</h3>
          <div className="space-y-4">
            {[
              { label: 'Active', value: stats.activeEmployees, tone: 'bg-brand-green' },
              { label: 'On Leave', value: stats.onLeaveEmployees, tone: 'bg-brand-yellow' },
              { label: 'Suspended', value: stats.suspendedEmployees, tone: 'bg-orange-500' },
              { label: 'Exited', value: stats.exitedEmployees, tone: 'bg-brand-red' },
            ].map((row) => {
              const pct = stats.totalEmployees ? Math.round((row.value / stats.totalEmployees) * 100) : 0;
              return (
                <div key={row.label}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-ink font-medium">{row.label}</span>
                    <span className="text-muted">
                      {row.value} · {pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface2 overflow-hidden">
                    <div className={`h-full rounded-full ${row.tone}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
