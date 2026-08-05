import React, { useState } from 'react';
import type { ColumnSchema, RowData } from '../types/data';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { formatCellValue } from '../utils/typeInference';

interface GroupedViewProps {
  columns: ColumnSchema[];
  rows: RowData[];
  groupByColumnId?: string;
  onSelectGroupBy: (colId: string) => void;
}

export const GroupedView: React.FC<GroupedViewProps> = ({
  columns,
  rows,
  groupByColumnId,
  onSelectGroupBy,
}) => {
  const visibleColumns = columns.filter(c => c.visible).sort((a, b) => a.order - b.order);

  // Skip timestamp/date/Hindi columns — prefer categorical columns
  const SKIP_COLS = /टाइमस्टैम्प|timestamp|date|तारीख/i;
  const PREFER_COLS = /c\/o|care.?of|mode|careof|name|status/i;

  const activeGroupColId =
    groupByColumnId ||
    columns.find(c => PREFER_COLS.test(c.id) || PREFER_COLS.test(c.label))?.id ||
    columns.find(c => c.type === 'status')?.id ||
    columns.find(c => !SKIP_COLS.test(c.id) && !SKIP_COLS.test(c.label))?.id ||
    columns[0]?.id ||
    '';

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Build groups
  const groupsMap = new Map<string, RowData[]>();

  rows.forEach(row => {
    const rawGroupVal = row[activeGroupColId];
    const groupKey = rawGroupVal !== null && rawGroupVal !== undefined && String(rawGroupVal).trim() !== ''
      ? String(rawGroupVal)
      : 'Unspecified / Empty';

    if (!groupsMap.has(groupKey)) {
      groupsMap.set(groupKey, []);
    }
    groupsMap.get(groupKey)!.push(row);
  });

  const toggleGroup = (key: string) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setExpandedGroups(next);
  };

  const groupEntries = Array.from(groupsMap.entries());

  return (
    <div style={{ margin: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* Grouping Header Control */}
      <div
        className="glass-panel"
        style={{
          padding: '0.85rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <Layers className="text-indigo-400" size={20} />
          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Group-By Section View</h3>
            <p style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
              Organize form submissions into structured categorical sections
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Group by Field:</span>
          <select
            className="input-field select-field"
            style={{ width: '220px', fontWeight: 600 }}
            value={activeGroupColId}
            onChange={(e) => onSelectGroupBy(e.target.value)}
          >
            {columns.map(col => (
              <option key={col.id} value={col.id}>
                {col.label} ({col.type})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Accordion Groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {groupEntries.map(([groupKey, groupRows]) => {
          const isCollapsed = expandedGroups.has(groupKey);

          // Calculate simple aggregate numbers (e.g. numeric averages)
          const numericCol = visibleColumns.find(c => c.type === 'number' || c.type === 'currency' || c.type === 'rating');
          let numAvg = 0;
          if (numericCol) {
            const vals = groupRows.map(r => Number(r[numericCol.id])).filter(v => !isNaN(v));
            if (vals.length > 0) {
              numAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
            }
          }

          return (
            <div key={groupKey} className="glass-panel" style={{ overflow: 'hidden' }}>
              
              {/* Accordion Header */}
              <div
                onClick={() => toggleGroup(groupKey)}
                style={{
                  padding: '0.85rem 1.25rem',
                  background: 'var(--bg-tertiary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                  <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                    {groupKey}
                  </span>
                  <span className="badge badge-info" style={{ fontWeight: 700 }}>
                    {groupRows.length} entries
                  </span>
                </div>

                {numericCol && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    Avg {numericCol.label}:{' '}
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>
                      {numericCol.type === 'rating' ? `${numAvg.toFixed(1)} / 5` : formatCellValue(numAvg, numericCol.type)}
                    </span>
                  </div>
                )}
              </div>

              {/* Accordion Table Content */}
              {!isCollapsed && (
                <div className="table-container" style={{ borderRadius: 0, border: 'none' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        {visibleColumns.map(col => (
                          <th key={col.id}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {groupRows.map(row => (
                        <tr key={String(row._id)}>
                          {visibleColumns.map(col => (
                            <td key={col.id}>{formatCellValue(row[col.id], col.type)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
