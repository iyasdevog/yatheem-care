import React, { useState } from 'react';
import type {
  ColumnSchema,
  RowData,
  SortRule,
} from '../types/data';
import { formatCellValue } from '../utils/typeInference';
import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Star,
  Check,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
} from 'lucide-react';

interface DataTableProps {
  columns: ColumnSchema[];
  rows: RowData[];
  sortRules: SortRule[];
  onToggleColumnSort: (colId: string) => void;
  onCellEdit: (rowId: string, colId: string, newValue: any) => void;
  onDeleteRow: (rowId: string) => void;
  onBulkDeleteRows: (rowIds: string[]) => void;
  onCopySelectedRows: (rowIds: string[]) => void;
  onReorderRows?: (newRows: RowData[]) => void;
}

export const DataTable: React.FC<DataTableProps> = ({
  columns,
  rows,
  sortRules,
  onToggleColumnSort,
  onCellEdit,
  onDeleteRow,
  onBulkDeleteRows,
  onCopySelectedRows,
}) => {
  const visibleColumns = columns.filter(c => c.visible).sort((a, b) => a.order - b.order);

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);

  const totalPages = Math.ceil(rows.length / rowsPerPage) || 1;
  const paginatedRows = rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  // Checkbox handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRowIds(new Set(paginatedRows.map(r => String(r._id))));
    } else {
      setSelectedRowIds(new Set());
    }
  };

  const handleToggleSelectRow = (rowId: string) => {
    const next = new Set(selectedRowIds);
    if (next.has(rowId)) {
      next.delete(rowId);
    } else {
      next.add(rowId);
    }
    setSelectedRowIds(next);
  };

  // Inline Cell Editing
  const handleStartCellEdit = (rowId: string, colId: string, currentValue: any) => {
    setEditingCell({ rowId, colId });
    setEditValue(currentValue === null || currentValue === undefined ? '' : String(currentValue));
  };

  const handleSaveCellEdit = () => {
    if (editingCell) {
      onCellEdit(editingCell.rowId, editingCell.colId, editValue);
      setEditingCell(null);
    }
  };

  // Badge status color helper
  const getStatusBadgeClass = (strVal: string) => {
    const lower = strVal.toLowerCase();
    if (['resolved', 'completed', 'passed', 'approved', 'yes', 'offer extended'].includes(lower)) {
      return 'badge-success';
    }
    if (['pending action', 'under review', 'urgent', 'screening passed'].includes(lower)) {
      return 'badge-warning';
    }
    if (['rejected', 'high', 'urgent', 'failed', 'no'].includes(lower)) {
      return 'badge-danger';
    }
    return 'badge-neutral';
  };

  return (
    <div style={{ margin: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      
      {/* Bulk Actions Header Bar */}
      {selectedRowIds.size > 0 && (
        <div
          className="glass-panel"
          style={{
            padding: '0.65rem 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--accent-primary)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.875rem' }}>
            <CheckSquare size={16} className="text-indigo-400" />
            Selected <span className="gradient-text">{selectedRowIds.size}</span> rows
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onCopySelectedRows(Array.from(selectedRowIds))}
            >
              <Copy size={14} /> Copy Selected for Google Sheets
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => {
                onBulkDeleteRows(Array.from(selectedRowIds));
                setSelectedRowIds(new Set());
              }}
            >
              <Trash2 size={14} /> Delete Selected ({selectedRowIds.size})
            </button>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              {/* Select All Checkbox Header */}
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={paginatedRows.length > 0 && paginatedRows.every(r => selectedRowIds.has(String(r._id)))}
                  onChange={handleSelectAll}
                />
              </th>

              {/* Column Headers */}
              {visibleColumns.map(col => {
                const sortRule = sortRules.find(r => r.columnId === col.id);

                return (
                  <th
                    key={col.id}
                    onClick={() => onToggleColumnSort(col.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span>{col.label}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
                        {sortRule ? (
                          sortRule.direction === 'asc' ? (
                            <ArrowUp size={14} className="text-indigo-400" />
                          ) : (
                            <ArrowDown size={14} className="text-indigo-400" />
                          )
                        ) : (
                          <ArrowUpDown size={12} style={{ opacity: 0.3 }} />
                        )}
                      </span>
                    </div>
                  </th>
                );
              })}

              <th style={{ width: '60px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 2} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  No responses match the selected filters or search query.
                </td>
              </tr>
            ) : (
              paginatedRows.map(row => {
                const rowId = String(row._id);
                const isSelected = selectedRowIds.has(rowId);

                return (
                  <tr key={rowId} className={isSelected ? 'selected' : ''}>
                    
                    {/* Row Checkbox */}
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(rowId)}
                      />
                    </td>

                    {/* Dynamic Column Cells */}
                    {visibleColumns.map(col => {
                      const rawValue = row[col.id];
                      const isEditing = editingCell?.rowId === rowId && editingCell?.colId === col.id;

                      return (
                        <td
                          key={col.id}
                          className="cell-editable"
                          onDoubleClick={() => handleStartCellEdit(rowId, col.id, rawValue)}
                          title="Double-click to inline edit cell"
                        >
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <input
                                type="text"
                                className="input-field"
                                autoFocus
                                style={{ padding: '2px 6px', fontSize: '0.8125rem', height: '26px' }}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveCellEdit();
                                  if (e.key === 'Escape') setEditingCell(null);
                                }}
                              />
                              <button className="btn btn-ghost btn-icon btn-sm" onClick={handleSaveCellEdit}>
                                <Check size={14} className="text-emerald-400" />
                              </button>
                            </div>
                          ) : col.type === 'status' && rawValue ? (
                            <span className={`badge ${getStatusBadgeClass(String(rawValue))}`}>
                              {String(rawValue)}
                            </span>
                          ) : col.type === 'rating' && rawValue !== null ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Star size={14} fill="#f59e0b" color="#f59e0b" />
                              <span style={{ fontWeight: 700 }}>{String(rawValue)}</span>
                            </div>
                          ) : col.type === 'boolean' ? (
                            <span className={`badge ${['true', 'yes', '1'].includes(String(rawValue).toLowerCase()) ? 'badge-success' : 'badge-neutral'}`}>
                              {formatCellValue(rawValue, col.type)}
                            </span>
                          ) : (
                            formatCellValue(rawValue, col.type)
                          )}
                        </td>
                      );
                    })}

                    {/* Delete Action */}
                    <td style={{ textAlign: 'center' }}>
                      <button
                        className="btn btn-ghost btn-icon btn-sm text-red-400"
                        onClick={() => onDeleteRow(rowId)}
                        title="Delete entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer Controls */}
      <div
        className="glass-panel"
        style={{
          padding: '0.65rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          <span>Rows per page:</span>
          <select
            className="input-field select-field"
            style={{ width: '70px', padding: '2px 24px 2px 8px', fontSize: '0.8125rem' }}
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Page {currentPage} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              className="btn btn-secondary btn-icon btn-sm"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="btn btn-secondary btn-icon btn-sm"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
