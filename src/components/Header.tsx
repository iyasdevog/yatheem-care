import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Upload,
  Download,
  FileCode,
  Sun,
  Moon,
  Sparkles,
  Table as TableIcon,
  BarChart3,
  Cloud,
  CloudOff,
  Loader2,
  Heart,
  LayoutDashboard,
  Printer,
  GitMerge,
} from 'lucide-react';
import type { Dataset } from '../types/data';

interface HeaderProps {
  onOpenImportModal: () => void;
  onOpenAddRowModal: () => void;
  onLoadSample?: (dataset: Dataset) => void;
  onExportCSV: () => void;
  onExportExcel: () => void;
  activeView: 'dashboard' | 'sponsorship' | 'table' | 'grouped' | 'analytics' | 'standardizer';
  onChangeView: (view: 'dashboard' | 'sponsorship' | 'table' | 'grouped' | 'analytics' | 'standardizer') => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  sampleDatasets?: Dataset[];
  firebaseSyncStatus?: 'idle' | 'syncing' | 'synced' | 'error';
}

export const Header: React.FC<HeaderProps> = ({
  onOpenImportModal,
  onOpenAddRowModal,
  onExportCSV,
  onExportExcel,
  activeView,
  onChangeView,
  theme,
  onToggleTheme,
  firebaseSyncStatus = 'idle',
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <header className="glass-panel" style={{ margin: '1rem', padding: '0.85rem 1.5rem', borderRadius: 'var(--radius-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        
        {/* Left Branding & Dataset Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', flex: '1 1 auto', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'var(--accent-gradient)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-glow)',
                flexShrink: 0,
              }}
            >
              <Heart color="#ffffff" size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                  Yatheem<span className="gradient-text">Care</span>
                </h1>
                <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                  Cloud Sync
                </span>
                {/* Firebase Live Sync Status */}
                {firebaseSyncStatus === 'syncing' && (
                  <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(99,102,241,0.2)', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Syncing...
                  </span>
                )}
                {firebaseSyncStatus === 'synced' && (
                  <span className="badge badge-success" style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Cloud size={11} /> Firebase Synced
                  </span>
                )}
                {firebaseSyncStatus === 'error' && (
                  <span className="badge badge-danger" style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <CloudOff size={11} /> Sync Error
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                Yatheem Student Donation & Sponsorship Portal
              </p>
            </div>
          </div>

        </div>

        {/* Center View Navigation Tabs - Scrollable on Mobile */}
        <div
          style={{
            display: 'flex',
            background: 'var(--bg-tertiary)',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            gap: '4px',
            border: '1px solid var(--border-color)',
            overflowX: 'auto',
            maxWidth: '100%',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <button
            className={`btn btn-sm ${activeView === 'dashboard' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => onChangeView('dashboard')}
          >
            <LayoutDashboard size={16} /> Dashboard
          </button>
          <button
            className={`btn btn-sm ${activeView === 'sponsorship' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => onChangeView('sponsorship')}
          >
            <Sparkles size={16} className="text-amber-400" /> Full Matrix Report
          </button>
          <button
            className={`btn btn-sm ${activeView === 'table' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => onChangeView('table')}
          >
            <TableIcon size={16} /> Raw Ledger Table
          </button>
          <button
            className={`btn btn-sm ${activeView === 'standardizer' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => onChangeView('standardizer')}
          >
            <GitMerge size={16} className="text-emerald-400" /> Data Standardizer
          </button>
          <button
            className={`btn btn-sm ${activeView === 'analytics' ? 'btn-primary' : 'btn-ghost'}`}
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => onChangeView('analytics')}
          >
            <BarChart3 size={16} /> Analytics
          </button>
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          
          {/* Populate New Data */}
          <button className="btn btn-primary" onClick={onOpenAddRowModal}>
            <Plus size={16} /> Populate Data
          </button>

          {/* Import / Paste */}
          <button className="btn btn-secondary" onClick={onOpenImportModal}>
            <Upload size={16} /> Import
          </button>

          {/* Print Button */}
          <button 
            className="btn btn-secondary" 
            onClick={() => window.print()}
            title="Print Current View"
          >
            <Printer size={16} /> Print
          </button>

          {/* Export Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setShowExportMenu(!showExportMenu)}
            >
              <Download size={16} /> Export
            </button>
            {showExportMenu && (
              <div
                className="glass-panel"
                style={{
                  position: 'absolute',
                  top: '110%',
                  right: 0,
                  width: '240px',
                  zIndex: 100,
                  padding: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <button
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', width: '100%' }}
                  onClick={() => {
                    onExportCSV();
                    setShowExportMenu(false);
                  }}
                >
                  <FileCode size={16} /> Export CSV File
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ justifyContent: 'flex-start', width: '100%' }}
                  onClick={() => {
                    onExportExcel();
                    setShowExportMenu(false);
                  }}
                >
                  <FileSpreadsheet size={16} /> Export Excel (.xlsx)
                </button>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button className="btn btn-secondary btn-icon" onClick={onToggleTheme} title="Toggle Dark/Light mode">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
};
