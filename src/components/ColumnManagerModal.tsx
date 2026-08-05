import React, { useState } from 'react';
import type { ColumnSchema, ColumnType } from '../types/data';
import { Columns, Eye, EyeOff, Plus, X, ArrowUp, ArrowDown } from 'lucide-react';

interface ColumnManagerModalProps {
  columns: ColumnSchema[];
  onUpdateColumns: (updated: ColumnSchema[]) => void;
  onClose: () => void;
}

export const ColumnManagerModal: React.FC<ColumnManagerModalProps> = ({
  columns,
  onUpdateColumns,
  onClose,
}) => {
  const [localCols, setLocalCols] = useState<ColumnSchema[]>([...columns]);
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType] = useState<ColumnType>('text');

  const handleToggleVisibility = (id: string) => {
    setLocalCols(
      localCols.map(c => (c.id === id ? { ...c, visible: !c.visible } : c))
    );
  };

  const handleTypeChange = (id: string, type: ColumnType) => {
    setLocalCols(
      localCols.map(c => (c.id === id ? { ...c, type } : c))
    );
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const next = [...localCols];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= next.length) return;

    const temp = next[index];
    next[index] = next[targetIdx];
    next[targetIdx] = temp;

    // re-assign order
    next.forEach((c, i) => (c.order = i));
    setLocalCols(next);
  };

  const handleAddNewColumn = () => {
    if (!newColLabel.trim()) return;
    const colId = newColLabel.trim();
    if (localCols.some(c => c.id === colId)) return;

    const newCol: ColumnSchema = {
      id: colId,
      label: colId,
      type: newColType,
      visible: true,
      order: localCols.length,
    };

    setLocalCols([...localCols, newCol]);
    setNewColLabel('');
  };

  const handleSave = () => {
    onUpdateColumns(localCols);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
        
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
              <Columns size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Google Sheet Column Manager</h3>
              <p style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
                Configure visible headings, column order, data types, or add new sheet fields
              </p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          
          {/* Add New Column Box */}
          <div
            style={{
              padding: '0.85rem',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
            }}
          >
            <input
              type="text"
              className="input-field"
              placeholder="New Google Sheet Column Heading..."
              value={newColLabel}
              onChange={(e) => setNewColLabel(e.target.value)}
              style={{ flex: 1 }}
            />
            <select
              className="input-field select-field"
              style={{ width: '130px' }}
              value={newColType}
              onChange={(e) => setNewColType(e.target.value as ColumnType)}
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="date">Date</option>
              <option value="email">Email</option>
              <option value="status">Status Pill</option>
              <option value="rating">Rating (1-5)</option>
              <option value="boolean">Yes/No</option>
              <option value="currency">Currency</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={handleAddNewColumn}>
              <Plus size={16} /> Add Column
            </button>
          </div>

          {/* List of Columns */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '360px', overflowY: 'auto' }}>
            {localCols.map((col, index) => (
              <div
                key={col.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                  padding: '0.65rem 0.85rem',
                  background: 'var(--bg-card)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  opacity: col.visible ? 1 : 0.55,
                }}
              >
                {/* Order up/down */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    style={{ padding: '1px' }}
                    disabled={index === 0}
                    onClick={() => handleMove(index, 'up')}
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    className="btn btn-ghost btn-icon btn-sm"
                    style={{ padding: '1px' }}
                    disabled={index === localCols.length - 1}
                    onClick={() => handleMove(index, 'down')}
                  >
                    <ArrowDown size={12} />
                  </button>
                </div>

                {/* Visible Toggle */}
                <button
                  className={`btn btn-sm ${col.visible ? 'btn-secondary' : 'btn-ghost'}`}
                  style={{ padding: '0.35rem 0.65rem' }}
                  onClick={() => handleToggleVisibility(col.id)}
                >
                  {col.visible ? <Eye size={16} className="text-emerald-400" /> : <EyeOff size={16} />}
                </button>

                {/* Column Name */}
                <div style={{ flex: 1, fontWeight: 600, fontSize: '0.875rem' }}>
                  {col.label}
                </div>

                {/* Column Data Type Selector */}
                <select
                  className="input-field select-field"
                  style={{ width: '130px', fontSize: '0.78125rem', padding: '0.35rem 0.65rem' }}
                  value={col.type}
                  onChange={(e) => handleTypeChange(col.id, e.target.value as ColumnType)}
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="email">Email</option>
                  <option value="status">Status Pill</option>
                  <option value="rating">Rating</option>
                  <option value="boolean">Yes/No</option>
                  <option value="currency">Currency</option>
                </select>
              </div>
            ))}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            Save Column Schema
          </button>
        </div>
      </div>
    </div>
  );
};
