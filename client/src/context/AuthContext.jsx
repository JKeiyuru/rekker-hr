// client/src/context/AuthContext.jsx
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('rekker-hr-user');
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(true);
  // Self-service profile + completion ({ completion, editable, locked, readOnly }).
  // null when the login isn't linked to an employee record.
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const refreshProfile = useCallback(() => {
    setProfileLoading(true);
    return api
      .get('/profile')
      .then((res) => setProfile(res.data))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, []);

  const hasEmployee = !!user?.employee;
  useEffect(() => {
    if (user && hasEmployee) refreshProfile();
    else setProfile(null);
  }, [user?._id, hasEmployee, refreshProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const token = localStorage.getItem('rekker-hr-token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data);
        localStorage.setItem('rekker-hr-user', JSON.stringify(res.data));
      })
      .catch(() => {
        localStorage.removeItem('rekker-hr-token');
        localStorage.removeItem('rekker-hr-user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('rekker-hr-token', data.token);
    localStorage.setItem('rekker-hr-user', JSON.stringify(data));
    setUser(data);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('rekker-hr-token');
    localStorage.removeItem('rekker-hr-user');
    setUser(null);
    setProfile(null);
  };

  const can = (...roles) => user && roles.includes(user.role);
  // Departments this user may recommend leave for (set by an admin).
  const recommendDepartments = user?.recommendDepartments || [];
  const canRecommend = recommendDepartments.length > 0;

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can, canRecommend, recommendDepartments, profile, setProfile, profileLoading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
