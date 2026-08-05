import React, { useState } from 'react';
import type { ColumnSchema, SortRule } from '../types/data';
import { ArrowUpDown, Plus, Trash2, ArrowUp, ArrowDown, X } from 'lucide-react';

interface MultiSortModalProps {
  columns: ColumnSchema[];
  sortRules: SortRule[];
  onApplySort: (rules: SortRule[]) => void;
  onClose: () => void;
}

export const MultiSortModal: React.FC<MultiSortModalProps> = ({
  columns,
  sortRules,
  onApplySort,
  onClose,
}) => {
  const [localRules, setLocalRules] = useState<SortRule[]>(
    sortRules.length > 0 ? [...sortRules] : [{ columnId: columns[0]?.id || '', direction: 'asc' }]
  );

  const handleAddRule = () => {
    const unusedCol = columns.find(c => !localRules.some(r => r.columnId === c.id));
    if (unusedCol) {
      setLocalRules([...localRules, { columnId: unusedCol.id, direction: 'asc' }]);
    }
  };

  const handleRemoveRule = (index: number) => {
    setLocalRules(localRules.filter((_, i) => i !== index));
  };

  const handleUpdateRule = (index: number, updates: Partial<SortRule>) => {
    const next = [...localRules];
    next[index] = { ...next[index], ...updates };
    setLocalRules(next);
  };

  const handleSave = () => {
    onApplySort(localRules.filter(r => Boolean(r.columnId)));
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
        
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--accent-glow)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
              }}
            >
              <ArrowUpDown size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Multi-Column Data Sort</h3>
              <p style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
                Order responses by stacking multiple primary and secondary column rules
              </p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {localRules.map((rule, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                background: 'var(--bg-primary)',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}
            >
              <span
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  minWidth: '60px',
                }}
              >
                {idx === 0 ? 'Sort by' : 'Then by'}
              </span>

              {/* Column Select */}
              <select
                className="input-field select-field"
                style={{ flex: 1 }}
                value={rule.columnId}
                onChange={(e) => handleUpdateRule(idx, { columnId: e.target.value })}
              >
                {columns.map(col => (
                  <option key={col.id} value={col.id}>
                    {col.label} ({col.type})
                  </option>
                ))}
              </select>

              {/* Direction Toggle */}
              <button
                className="btn btn-secondary btn-sm"
                style={{ minWidth: '100px', justifyContent: 'center' }}
                onClick={() =>
                  handleUpdateRule(idx, { direction: rule.direction === 'asc' ? 'desc' : 'asc' })
                }
              >
                {rule.direction === 'asc' ? (
                  <>
                    <ArrowUp size={14} className="text-emerald-400" /> ASC (A-Z)
                  </>
                ) : (
                  <>
                    <ArrowDown size={14} className="text-indigo-400" /> DESC (Z-A)
                  </>
                )}
              </button>

              {/* Remove Rule */}
              {localRules.length > 1 && (
                <button
                  className="btn btn-ghost btn-sm btn-icon text-red-400"
                  onClick={() => handleRemoveRule(idx)}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}

          {localRules.length < columns.length && (
            <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={handleAddRule}>
              <Plus size={16} /> Add Secondary Sort Column
            </button>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setLocalRules([])}>
            Clear All Sorts
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Apply Multi-Sort Rules
          </button>
        </div>
      </div>
    </div>
  );
};
