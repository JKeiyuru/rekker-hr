// client/src/pages/Login.jsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getDefaultRoute } from '../config/nav';
import { Moon, Sun, Lock, Mail } from 'lucide-react';
import Button from '../components/Button';
import { Field, TextInput } from '../components/Fields';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await login(email, password);
      navigate(location.state?.from || getDefaultRoute(data.role), { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-bg relative overflow-hidden">
      <button
        onClick={toggleTheme}
        className="focus-ring absolute top-5 right-5 z-10 h-9 w-9 rounded-full flex items-center justify-center text-ink hover:bg-surface2"
      >
        {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>

      {/* Brand panel */}
      <div className="hidden lg:flex w-1/2 relative items-center justify-center p-16 bg-[#0d0d0f] overflow-hidden">
        <div
          className="absolute -top-32 -left-32 h-96 w-96 rounded-full blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, #D60821, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-40 -right-24 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #1B8A41, transparent 70%)' }}
        />
        <div
          className="absolute top-1/3 right-10 h-64 w-64 rounded-full blur-3xl opacity-20"
          style={{ background: 'radial-gradient(circle, #F0AD14, transparent 70%)' }}
        />
        <div className="relative z-10 max-w-md text-white">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-red font-bold text-xl mb-8">
            R
          </span>
          <h1 className="text-4xl font-semibold tracking-tight leading-tight">
            The employee lifecycle,
            <br />
            handled beautifully.
          </h1>
          <p className="mt-4 text-white/60 leading-relaxed">
            One system for records, attendance, leave, payroll support, performance,
            recruitment, assets and more — built for how Rekker actually works.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6">
        <form onSubmit={handleSubmit} className="w-full max-w-sm animate-riseIn">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-red text-white font-bold text-sm">
              R
            </span>
            <p className="font-semibold text-ink">Rekker HR</p>
          </div>

          <h2 className="text-2xl font-semibold text-ink tracking-tight">Welcome back</h2>
          <p className="text-sm text-muted mt-1 mb-8">Sign in to your Rekker HR account</p>

          <Field label="Email address" required>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <TextInput
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@rekker.co.ke"
                className="pl-10"
              />
            </div>
          </Field>

          <Field label="Password" required>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <TextInput
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-10"
              />
            </div>
          </Field>

          <Button type="submit" className="w-full mt-2" size="lg" loading={loading}>
            Sign in
          </Button>

          <p className="text-xs text-muted text-center mt-6">
            First time here? Ask your administrator for an account, or run the seed
            script for a default admin login.
          </p>
        </form>
      </div>
    </div>
  );
}
