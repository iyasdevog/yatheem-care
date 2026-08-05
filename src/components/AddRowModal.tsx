import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import type { ColumnSchema, RowData } from '../types/data';
import { Plus, X, Sparkles, Star } from 'lucide-react';

interface AddRowModalProps {
  columns: ColumnSchema[];
  onAddRow: (row: RowData) => void;
  onClose: () => void;
}

export const AddRowModal: React.FC<AddRowModalProps> = ({
  columns,
  onAddRow,
  onClose,
}) => {
  const visibleColumns = columns.filter(c => c.visible).sort((a, b) => a.order - b.order);

  // Initialize form state with smart defaults
  const [formData, setFormData] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    visibleColumns.forEach(col => {
      if (col.id.toLowerCase().includes('timestamp') || col.id.toLowerCase().includes('date')) {
        initial[col.id] = nowStr;
      } else if (col.type === 'number' || col.type === 'rating') {
        initial[col.id] = col.type === 'rating' ? 5 : 0;
      } else if (col.type === 'boolean') {
        initial[col.id] = 'Yes';
      } else if (col.options && col.options.length > 0) {
        initial[col.id] = col.options[0];
      } else {
        initial[col.id] = '';
      }
    });

    return initial;
  });

  const handleChange = (colId: string, value: any) => {
    setFormData(prev => ({ ...prev, [colId]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newRow: RowData = {
      _id: `row_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      ...formData,
    };

    onAddRow(newRow);

    // Fire celebratory confetti!
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { y: 0.6 },
    });

    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
              }}
            >
              <Plus size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Populate New Form Response</h3>
              <p style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
                Appends a new entry matching exact Google Sheet column headings
              </p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              {visibleColumns.map(col => {
                const val = formData[col.id] ?? '';

                return (
                  <div key={col.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {col.label}
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                        ({col.type})
                      </span>
                    </label>

                    {/* Status Dropdown */}
                    {col.options && col.options.length > 0 ? (
                      <select
                        className="input-field select-field"
                        value={val}
                        onChange={(e) => handleChange(col.id, e.target.value)}
                      >
                        {col.options.map(opt => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : col.type === 'number' || col.type === 'currency' ? (
                      <input
                        type="number"
                        className="input-field"
                        value={val}
                        onChange={(e) => handleChange(col.id, e.target.valueAsNumber || e.target.value)}
                      />
                    ) : col.type === 'rating' ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            type="button"
                            key={star}
                            className="btn btn-ghost btn-sm btn-icon"
                            onClick={() => handleChange(col.id, star)}
                          >
                            <Star
                              size={20}
                              fill={Number(val) >= star ? '#f59e0b' : 'none'}
                              color={Number(val) >= star ? '#f59e0b' : 'var(--text-muted)'}
                            />
                          </button>
                        ))}
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, marginLeft: '0.25rem' }}>
                          {val} / 5
                        </span>
                      </div>
                    ) : col.type === 'boolean' ? (
                      <select
                        className="input-field select-field"
                        value={val}
                        onChange={(e) => handleChange(col.id, e.target.value)}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    ) : col.type === 'email' ? (
                      <input
                        type="email"
                        className="input-field"
                        placeholder="name@example.com"
                        value={val}
                        onChange={(e) => handleChange(col.id, e.target.value)}
                      />
                    ) : (
                      <input
                        type="text"
                        className="input-field"
                        value={val}
                        onChange={(e) => handleChange(col.id, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Sparkles size={16} /> Populate & Append Entry
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
