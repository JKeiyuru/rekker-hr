// client/src/components/DataTable.jsx
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Spinner, EmptyState } from './Feedback';

export default function DataTable({ columns, rows, loading, onEdit, onDelete, onRowClick, emptyMessage }) {
  const [openMenu, setOpenMenu] = useState(null);

  if (loading) return <Spinner />;
  if (!rows || rows.length === 0) return <EmptyState title={emptyMessage || 'No records found'} />;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface2/50">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left font-medium text-muted px-5 py-3 whitespace-nowrap"
                >
                  {col.header}
                </th>
              ))}
              {(onEdit || onDelete) && <th className="w-12" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row._id || i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-border last:border-0 transition-colors hover:bg-surface2/60 ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-5 py-3.5 align-middle">
                    {col.render ? col.render(row) : row[col.key] ?? '—'}
                  </td>
                ))}
                {(onEdit || onDelete) && (
                  <td className="px-3 relative" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="focus-ring rounded-full p-1.5 text-muted hover:bg-surface2 hover:text-ink"
                      onClick={() => setOpenMenu(openMenu === row._id ? null : row._id)}
                    >
                      <MoreHorizontal size={16} />
                    </button>
                    {openMenu === row._id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                        <div className="absolute right-3 top-9 z-20 w-36 card p-1 shadow-floating animate-riseIn">
                          {onEdit && (
                            <button
                              onClick={() => {
                                setOpenMenu(null);
                                onEdit(row);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-surface2 text-ink"
                            >
                              <Pencil size={14} /> Edit
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => {
                                setOpenMenu(null);
                                onDelete(row);
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-brand-red/10 text-brand-red"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
