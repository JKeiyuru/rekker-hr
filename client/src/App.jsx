// client/src/App.jsx
import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Attendance from './pages/Attendance';
import Leave from './pages/Leave';
import Payroll from './pages/Payroll';
import Performance from './pages/Performance';
import Recruitment from './pages/Recruitment';
import Onboarding from './pages/Onboarding';
import Assets from './pages/Assets';
import Training from './pages/Training';
import Disciplinary from './pages/Disciplinary';
import Documents from './pages/Documents';
import Users from './pages/Users';
import { useTheme } from './context/ThemeContext';

export default function App() {
  const { theme } = useTheme();

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          className: '',
          style: {
            background: theme === 'dark' ? '#1a1a1c' : '#ffffff',
            color: theme === 'dark' ? '#f2f2f5' : '#1a1a1c',
            border: '1px solid rgb(var(--color-border))',
            borderRadius: '12px',
            fontSize: '14px',
            boxShadow: '0 12px 40px -12px rgb(0 0 0 / 0.25)',
          },
          success: { iconTheme: { primary: '#1B8A41', secondary: '#fff' } },
          error: { iconTheme: { primary: '#D60821', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route
            path="/"
            element={
              <ProtectedRoute roles={['admin', 'hr', 'director', 'manager', 'department_manager']}>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employees"
            element={
              <ProtectedRoute roles={['admin', 'hr', 'director', 'manager', 'department_manager']}>
                <Employees />
              </ProtectedRoute>
            }
          />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/leave" element={<Leave />} />
          <Route
            path="/payroll"
            element={
              <ProtectedRoute roles={['admin', 'hr', 'director']}>
                <Payroll />
              </ProtectedRoute>
            }
          />
          <Route path="/performance" element={<Performance />} />
          <Route
            path="/recruitment"
            element={
              <ProtectedRoute roles={['admin', 'hr', 'director', 'manager']}>
                <Recruitment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/onboarding"
            element={
              <ProtectedRoute roles={['admin', 'hr', 'director', 'manager']}>
                <Onboarding />
              </ProtectedRoute>
            }
          />
          <Route path="/assets" element={<Assets />} />
          <Route path="/training" element={<Training />} />
          <Route
            path="/disciplinary"
            element={
              <ProtectedRoute roles={['admin', 'hr']}>
                <Disciplinary />
              </ProtectedRoute>
            }
          />
          <Route path="/documents" element={<Documents />} />
          <Route
            path="/users"
            element={
              <ProtectedRoute roles={['admin']}>
                <Users />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </>
  );
}
