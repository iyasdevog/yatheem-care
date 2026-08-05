import React from 'react';
import {
  Search,
  ArrowUpDown,
  Columns,
  Layers,
  X,
  RotateCcw,
} from 'lucide-react';
import type { ColumnSchema, FilterRule, SortRule } from '../types/data';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  columns: ColumnSchema[];
  filterRules: FilterRule[];
  onRemoveFilter: (id: string) => void;
  onClearAllFilters: () => void;
  sortRules: SortRule[];
  onOpenSortModal: () => void;
  onOpenColumnModal: () => void;
  groupByColumn: string | undefined;
  onGroupByChange: (colId: string | undefined) => void;
  totalRows: number;
  filteredRowsCount: number;
  onAddFilter: (rule: FilterRule) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  columns,
  filterRules,
  onRemoveFilter,
  onClearAllFilters,
  sortRules,
  onOpenSortModal,
  onOpenColumnModal,
  groupByColumn,
  onGroupByChange,
  totalRows,
  filteredRowsCount,
  onAddFilter,
}) => {
  const visibleColumns = columns.filter(c => c.visible);

  return (
    <div
      className="glass-panel"
      style={{
        margin: '0 1rem 1rem 1rem',
        padding: '0.85rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      {/* Upper Control Strip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        
        {/* Global Search */}
        <div style={{ position: 'relative', width: '320px', minWidth: '240px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '0.85rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
            }}
          />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '2.5rem', paddingRight: searchQuery ? '2.2rem' : '0.85rem' }}
            placeholder="Search responses, names, emails..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              className="btn btn-ghost btn-icon btn-sm"
              style={{
                position: 'absolute',
                right: '0.35rem',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px',
              }}
              onClick={() => onSearchChange('')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Sorting, Columns, Group-By Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          
          {/* Multi-Sort Trigger */}
          <button
            className={`btn ${sortRules.length > 0 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={onOpenSortModal}
          >
            <ArrowUpDown size={16} />
            Sort
            {sortRules.length > 0 && (
              <span
                style={{
                  background: 'rgba(255, 255, 255, 0.25)',
                  borderRadius: '999px',
                  padding: '1px 6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                {sortRules.length}
              </span>
            )}
          </button>

          {/* Columns Manager Trigger */}
          <button className="btn btn-secondary" onClick={onOpenColumnModal}>
            <Columns size={16} /> Columns ({visibleColumns.length}/{columns.length})
          </button>

          {/* Group-By Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Layers size={16} style={{ color: 'var(--text-muted)' }} />
            <select
              className="input-field select-field"
              style={{ width: '180px', fontSize: '0.85rem' }}
              value={groupByColumn || ''}
              onChange={(e) => onGroupByChange(e.target.value || undefined)}
            >
              <option value="">No Grouping</option>
              {columns
                .filter(col => !/टाइमस्टैम्प|timestamp|तारीख/i.test(col.id) && !/टाइमस्टैम्प|timestamp|तारीख/i.test(col.label))
                .map(col => (
                  <option key={col.id} value={col.id}>
                    Group by: {col.label}
                  </option>
                ))}
            </select>
          </div>

          {/* Quick Filter Add Dropdown */}
          <div style={{ position: 'relative' }}>
            <select
              className="input-field select-field"
              style={{ width: '160px', fontSize: '0.85rem' }}
              value=""
              onChange={(e) => {
                const colId = e.target.value;
                if (!colId) return;
                const col = columns.find(c => c.id === colId);
                if (!col) return;
                onAddFilter({
                  id: `filter_${Date.now()}`,
                  columnId: colId,
                  operator: col.type === 'number' || col.type === 'currency' ? 'greaterThan' : 'contains',
                  value: '',
                });
              }}
            >
              <option value="" disabled>+ Filter Field</option>
              {columns.map(col => (
                <option key={col.id} value={col.id}>
                  {col.label} ({col.type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right Row Metrics Pill */}
        <div
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-secondary)',
            fontWeight: 600,
            background: 'var(--bg-tertiary)',
            padding: '0.35rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-color)',
          }}
        >
          Showing <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{filteredRowsCount}</span> of {totalRows} entries
        </div>
      </div>

      {/* Active Filter Tags / Chips */}
      {(filterRules.length > 0 || searchQuery || sortRules.length > 0 || groupByColumn) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
            paddingTop: '0.5rem',
            borderTop: '1px dashed var(--border-color)',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Active Rules:
          </span>

          {/* Search Query Chip */}
          {searchQuery && (
            <span className="badge badge-info" style={{ padding: '0.35rem 0.65rem' }}>
              Search: "{searchQuery}"
              <button
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                onClick={() => onSearchChange('')}
              >
                <X size={12} />
              </button>
            </span>
          )}

          {/* Group-by Chip */}
          {groupByColumn && (
            <span className="badge badge-warning" style={{ padding: '0.35rem 0.65rem' }}>
              Grouped by: {columns.find(c => c.id === groupByColumn)?.label || groupByColumn}
              <button
                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                onClick={() => onGroupByChange(undefined)}
              >
                <X size={12} />
              </button>
            </span>
          )}

          {/* Filter Rules Chips */}
          {filterRules.map(rule => {
            const col = columns.find(c => c.id === rule.columnId);
            return (
              <span key={rule.id} className="badge badge-neutral" style={{ padding: '0.35rem 0.65rem', gap: '0.5rem' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{col?.label || rule.columnId}</span>
                <span style={{ color: 'var(--text-muted)' }}>{rule.operator}</span>
                <input
                  type="text"
                  className="input-field"
                  style={{
                    width: '110px',
                    padding: '2px 6px',
                    fontSize: '0.75rem',
                    height: '22px',
                    background: 'var(--bg-primary)',
                  }}
                  value={String(rule.value)}
                  onChange={(e) => {
                    rule.value = e.target.value;
                    onAddFilter({ ...rule });
                  }}
                  placeholder="Value..."
                />
                <button
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}
                  onClick={() => onRemoveFilter(rule.id)}
                >
                  <X size={12} />
                </button>
              </span>
            );
          })}

          {/* Clear All Button */}
          <button
            className="btn btn-ghost btn-sm text-red-400"
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            onClick={onClearAllFilters}
          >
            <RotateCcw size={12} /> Reset All Filters
          </button>
        </div>
      )}
    </div>
  );
};
