import React from 'react';
import type { ColumnSchema, RowData } from '../types/data';
import { BarChart3, PieChart, TrendingUp, Users, Star, Clock, CheckCircle2 } from 'lucide-react';
import { formatCellValue } from '../utils/typeInference';

interface AnalyticsDashboardProps {
  columns: ColumnSchema[];
  rows: RowData[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ columns, rows }) => {
  // Find key status and rating columns
  const statusCol = columns.find(c => c.type === 'status');
  const ratingCol = columns.find(c => c.type === 'rating');
  const numberCol = columns.find(c => c.type === 'number' || c.type === 'currency');

  // Status breakdown calculation
  const statusBreakdown: Record<string, number> = {};
  if (statusCol) {
    rows.forEach(r => {
      const val = String(r[statusCol.id] || 'Other');
      statusBreakdown[val] = (statusBreakdown[val] || 0) + 1;
    });
  }

  // Rating average calculation
  let avgRating = 0;
  if (ratingCol) {
    const ratings = rows.map(r => Number(r[ratingCol.id])).filter(v => !isNaN(v));
    if (ratings.length > 0) {
      avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    }
  }

  // Numeric sum calculation
  let numSum = 0;
  if (numberCol) {
    const numVals = rows.map(r => Number(r[numberCol.id])).filter(v => !isNaN(v));
    if (numVals.length > 0) {
      numSum = numVals.reduce((a, b) => a + b, 0);
    }
  }

  const maxStatusCount = Math.max(...Object.values(statusBreakdown), 1);

  return (
    <div style={{ margin: '0 1rem 1rem 1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Top Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        
        {/* Total Submissions Card */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Total Responses
            </span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'var(--accent-glow)', color: 'var(--accent-primary)' }}>
              <Users size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem' }}>
            {rows.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={14} /> Active Google Sheet Sync
          </div>
        </div>

        {/* Avg Rating Card */}
        {ratingCol && (
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Avg {ratingCol.label}
              </span>
              <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                <Star size={20} />
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem' }}>
              {avgRating.toFixed(1)} <span style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>/ 5</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Based on {rows.length} rated entries
            </div>
          </div>
        )}

        {/* Numeric Metrics Card */}
        {numberCol && (
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Total {numberCol.label}
              </span>
              <div style={{ padding: '8px', borderRadius: '10px', background: 'var(--info-bg)', color: 'var(--info)' }}>
                <BarChart3 size={20} />
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem' }}>
              {formatCellValue(numSum, numberCol.type)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              Aggregated sum metric
            </div>
          </div>
        )}

        {/* Total Columns Tracked */}
        <div className="glass-panel" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Headings Tracked
            </span>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
              <PieChart size={20} />
            </div>
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.5rem' }}>
            {columns.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            Google Form Fields
          </div>
        </div>

      </div>

      {/* Categorical Distribution Visual Bars */}
      {statusCol && Object.keys(statusBreakdown).length > 0 && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>
            {statusCol.label} Distribution
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Visual breakdown of responses by status categories
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Object.entries(statusBreakdown).map(([cat, count]) => {
              const pct = ((count / rows.length) * 100).toFixed(0);
              const barWidth = `${(count / maxStatusCount) * 100}%`;

              return (
                <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600 }}>
                    <span>{cat}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: '10px',
                      background: 'var(--bg-tertiary)',
                      borderRadius: '999px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: barWidth,
                        background: 'var(--accent-gradient)',
                        borderRadius: '999px',
                        transition: 'width 0.5s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Activity Log */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <Clock size={18} className="text-indigo-400" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Recent Responses Stream</h3>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {rows.slice(0, 5).map((r, i) => (
            <div
              key={i}
              style={{
                padding: '0.75rem 1rem',
                background: 'var(--bg-primary)',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CheckCircle2 size={16} className="text-emerald-400" />
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {String(r[columns[2]?.id || columns[1]?.id || columns[0]?.id] || 'Response Entry')}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {String(r[columns[0]?.id] || 'Just now')}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
