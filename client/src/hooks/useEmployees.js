// client/src/hooks/useEmployees.js
import { useEffect, useState } from 'react';
import api from '../api/axios';

export default function useEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/employees')
      .then((res) => setEmployees(res.data))
      .finally(() => setLoading(false));
  }, []);

  const employeeName = (idOrObj) => {
    if (!idOrObj) return '—';
    if (typeof idOrObj === 'object') return `${idOrObj.firstName} ${idOrObj.lastName}`;
    const emp = employees.find((e) => e._id === idOrObj);
    return emp ? `${emp.firstName} ${emp.lastName}` : '—';
  };

  return { employees, loading, employeeName };
}
