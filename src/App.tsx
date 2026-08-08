import React, { useState, useEffect, useMemo } from 'react';
import type { Dataset, ColumnSchema, RowData, SortRule, FilterRule } from './types/data';

import { exportToCSV, exportToExcel, copyToGoogleSheetsFormat } from './utils/csvParser';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { DataTable } from './components/DataTable';
import { GroupedView } from './components/GroupedView';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { SponsorshipReport } from './components/SponsorshipReport';
import { Dashboard, type NewDonorForm } from './components/Dashboard';
import { MultiSortModal } from './components/MultiSortModal';
import { ColumnManagerModal } from './components/ColumnManagerModal';
import { AddRowModal } from './components/AddRowModal';
import { ImportModal } from './components/ImportModal';
import { ToastContainer, type ToastMessage } from './components/Toast';
import { loadYatheemExcelWorkbook } from './utils/excelLoader';
import {
  syncAllDatasetsToFirebase,
  saveDatasetToFirebase,
  subscribeToFirebaseDatasets,
} from './utils/firebaseSync';
import {
  loadSlabs,
  saveSlabs,
  loadSlabAssignments,
  saveSlabAssignments,
  assignDonorToSlab,
  type DonationSlab,
  type SlabAssignment,
} from './utils/slabManager';

const STORAGE_KEY = 'yatheem_donation_datasets_v2';
const THEME_KEY = 'formflow_studio_theme';

export const App: React.FC = () => {
  // Theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem(THEME_KEY) as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Datasets state
  const [datasets, setDatasets] = useState<Dataset[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const yatheemOnly = parsed.filter((d: Dataset) =>
            d.id === 'yatheem_transactions' ||
            d.name.toLowerCase().includes('yatheem') ||
            d.name.toLowerCase().includes('sponsor')
          );
          if (yatheemOnly.length > 0) return yatheemOnly;
        }
      }
    } catch (e) {
      console.error('Failed to load datasets from localStorage', e);
    }
    return [];
  });

  // Slab & Assignment state (persisted to localStorage via slabManager)
  const [slabs, setSlabs] = useState<DonationSlab[]>(() => loadSlabs());
  const [slabAssignments, setSlabAssignments] = useState<SlabAssignment[]>(() => loadSlabAssignments());

  const handleSlabsChange = (updated: DonationSlab[]) => {
    saveSlabs(updated);
    setSlabs(updated);
  };

  const handleAssignmentsChange = (updated: SlabAssignment[]) => {
    saveSlabAssignments(updated);
    setSlabAssignments(updated);
  };

  const [activeDatasetId, setActiveDatasetId] = useState<string>(() => {
    return datasets[0]?.id || 'yatheem_transactions';
  });

  // Active dataset reference
  const currentDataset = useMemo(() => {
    return datasets.find(d => d.id === activeDatasetId) || datasets[0] || {
      id: 'yatheem_transactions',
      name: 'Yatheem Donation Transactions (Form Responses 1)',
      columns: [],
      rows: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceType: 'google_form',
    };
  }, [datasets, activeDatasetId]);

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(datasets));
    } catch (e) {
      console.error('Failed to save datasets to localStorage', e);
    }
  }, [datasets]);

  // Load current Yatheem Excel dataset & sync with Firebase
  useEffect(() => {
    // Only load from Excel if we have no local datasets at all
    if (datasets.length === 0) {
      loadYatheemExcelWorkbook().then((wb) => {
        if (wb) {
          // Only transaction dataset now — template sheet is ignored
          const yatheemDatasets = [wb.transactionDataset];
          setDatasets(yatheemDatasets);
          setActiveDatasetId(wb.transactionDataset.id);

          syncAllDatasetsToFirebase(yatheemDatasets).catch(err =>
            console.warn('Firebase sync notice:', err)
          );
        }
      });
    } else {
      // We have local datasets that might not have synced successfully to Firebase previously.
      // Force a sync to cloud now that sanitizeForFirebase is implemented.
      setFirebaseSyncStatus('syncing');
      syncAllDatasetsToFirebase(datasets)
        .then(() => {
          setFirebaseSyncStatus('synced');
          setTimeout(() => setFirebaseSyncStatus('idle'), 3000);
        })
        .catch(err => {
          console.warn('Firebase sync notice:', err);
          setFirebaseSyncStatus('error');
        });
    }

    // Real-time listener for Firebase Firestore updates
    const unsubscribe = subscribeToFirebaseDatasets((remoteDatasets) => {
      if (remoteDatasets && remoteDatasets.length > 0) {
        setDatasets(prev => {
          const remoteIds = new Set(remoteDatasets.map(r => r.id));
          const localOnly = prev.filter(p => !remoteIds.has(p.id));
          return [...remoteDatasets, ...localOnly];
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // View mode
  const [activeView, setActiveView] = useState<'dashboard' | 'sponsorship' | 'table' | 'grouped' | 'analytics'>('dashboard');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [sortRules, setSortRules] = useState<SortRule[]>([]);
  const [groupByColumn, setGroupByColumn] = useState<string | undefined>(undefined);

  // Modals state
  const [showSortModal, setShowSortModal] = useState(false);
  const [showColumnModal, setShowColumnModal] = useState(false);
  const [showAddRowModal, setShowAddRowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  // Firebase sync status
  const [firebaseSyncStatus, setFirebaseSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  // Toast notifications
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (type: 'success' | 'error' | 'info', title: string, message?: string) => {
    const id = `toast_${Date.now()}`;
    setToasts(prev => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleDismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Helper to update current dataset & sync to Firebase
  const updateCurrentDataset = (updater: (ds: Dataset) => Dataset) => {
    setDatasets(prev =>
      prev.map(d => {
        if (d.id === currentDataset.id) {
          const updated = updater(d);
          saveDatasetToFirebase(updated).catch(err =>
            console.warn('Firebase update notice:', err)
          );
          return updated;
        }
        return d;
      })
    );
  };

  // Multi-Column Sort logic
  const handleToggleColumnSort = (colId: string) => {
    const existing = sortRules.find(r => r.columnId === colId);
    if (!existing) {
      setSortRules([{ columnId: colId, direction: 'asc' }]);
    } else if (existing.direction === 'asc') {
      setSortRules([{ columnId: colId, direction: 'desc' }]);
    } else {
      setSortRules([]);
    }
  };

  // Filtered & Sorted Rows Calculation
  const filteredAndSortedRows = useMemo(() => {
    let result = [...currentDataset.rows];

    // 1. Global Search Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(row => {
        return Object.entries(row).some(([key, val]) => {
          if (key === '_id' || val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(q);
        });
      });
    }

    // 2. Field Filter Rules
    if (filterRules.length > 0) {
      result = result.filter(row => {
        return filterRules.every(rule => {
          const rawVal = row[rule.columnId];
          if (rawVal === null || rawVal === undefined) return false;

          const strVal = String(rawVal).toLowerCase();
          const targetVal = String(rule.value).toLowerCase();

          switch (rule.operator) {
            case 'equals':
              return strVal === targetVal;
            case 'contains':
              return strVal.includes(targetVal);
            case 'startsWith':
              return strVal.startsWith(targetVal);
            case 'greaterThan':
              return Number(rawVal) > Number(rule.value);
            case 'lessThan':
              return Number(rawVal) < Number(rule.value);
            default:
              return strVal.includes(targetVal);
          }
        });
      });
    }

    // 3. Multi-Column Sorting
    if (sortRules.length > 0) {
      result.sort((a, b) => {
        for (const rule of sortRules) {
          const valA = a[rule.columnId];
          const valB = b[rule.columnId];

          if (valA === valB) continue;
          if (valA === null || valA === undefined) return 1;
          if (valB === null || valB === undefined) return -1;

          let cmp = 0;
          if (typeof valA === 'number' && typeof valB === 'number') {
            cmp = valA - valB;
          } else {
            cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
          }

          if (cmp !== 0) {
            return rule.direction === 'asc' ? cmp : -cmp;
          }
        }
        return 0;
      });
    }

    return result;
  }, [currentDataset.rows, searchQuery, filterRules, sortRules]);

  // Data Operations
  const handleCellEdit = (rowId: string, colId: string, newValue: any) => {
    updateCurrentDataset(ds => ({
      ...ds,
      rows: ds.rows.map(r => (r._id === rowId ? { ...r, [colId]: newValue } : r)),
      updatedAt: new Date().toISOString(),
    }));
    addToast('success', 'Cell Updated', `Saved change for header "${colId}"`);
  };

  const handleDeleteRow = (rowId: string) => {
    updateCurrentDataset(ds => ({
      ...ds,
      rows: ds.rows.filter(r => r._id !== rowId),
      updatedAt: new Date().toISOString(),
    }));
    addToast('info', 'Row Deleted', 'Response entry removed');
  };

  const handleBulkDeleteRows = (rowIds: string[]) => {
    const idSet = new Set(rowIds);
    updateCurrentDataset(ds => ({
      ...ds,
      rows: ds.rows.filter(r => !idSet.has(String(r._id))),
      updatedAt: new Date().toISOString(),
    }));
    addToast('info', 'Bulk Rows Deleted', `Removed ${rowIds.length} entries`);
  };

  const handleAddRow = (newRow: RowData) => {
    updateCurrentDataset(ds => ({
      ...ds,
      rows: [newRow, ...ds.rows],
      updatedAt: new Date().toISOString(),
    }));
    addToast('success', 'Entry Appended!', 'New response populated in matching Google Sheet headings');
  };

  const handleAddDonor = (newDonor: NewDonorForm) => {
    // Add a transaction row into the transactions dataset
    const txDs = datasets.find(d => d.id === 'yatheem_transactions') || currentDataset;

    const newRow: RowData = {
      _id: `donor_row_${Date.now()}`,
      'Name': newDonor.name,
      'Contact 1': newDonor.phone,
      'C/O': newDonor.careOf || 'Direct',
      'Date': newDonor.startDate,
      'Amount': 0,
      'MODE': 'Pending',
      'Voucher no': 'N/A',
    };

    const updatedDs: Dataset = {
      ...txDs,
      rows: [newRow, ...txDs.rows],
      updatedAt: new Date().toISOString(),
    };

    setDatasets(prev => prev.map(d => (d.id === txDs.id ? updatedDs : d)));
    
    // Auto-assign slab if selected
    if (newDonor.slabId && newDonor.phone) {
      handleAssignmentsChange(assignDonorToSlab(
        slabAssignments,
        newDonor.phone,
        newDonor.slabId,
        newDonor.slabUnits || 1
      ));
    }

    setFirebaseSyncStatus('syncing');
    saveDatasetToFirebase(updatedDs)
      .then(() => {
        setFirebaseSyncStatus('synced');
        setTimeout(() => setFirebaseSyncStatus('idle'), 3000);
      })
      .catch((err) => {
        console.error("Firebase sync error:", err);
        setFirebaseSyncStatus('error');
      });

    addToast(
      'success',
      'Donor Added!',
      newDonor.slabId
        ? `${newDonor.name} assigned ${newDonor.slabUnits || 1}x ${newDonor.sponsorshipCategory.split('–')[0]?.trim()}`
        : `${newDonor.name} added — assign a slab from the Slab Manager`
    );
  };

  const handleImportDataset = (newDs: Dataset) => {
    setDatasets(prev => [newDs, ...prev]);
    setActiveDatasetId(newDs.id);
    // Also sync newly imported dataset to Firebase
    setFirebaseSyncStatus('syncing');
    saveDatasetToFirebase(newDs)
      .then(() => {
        setFirebaseSyncStatus('synced');
        setTimeout(() => setFirebaseSyncStatus('idle'), 3000);
      })
      .catch(() => setFirebaseSyncStatus('error'));
    addToast('success', 'Dataset Imported & Synced!', `Loaded ${newDs.rows.length} responses into workbench`);
  };

  const handleUpdateColumns = (updatedColumns: ColumnSchema[]) => {
    updateCurrentDataset(ds => ({
      ...ds,
      columns: updatedColumns,
      updatedAt: new Date().toISOString(),
    }));
    addToast('success', 'Schema Updated', 'Column headings and types saved');
  };

  // Export handlers
  const handleExportCSV = () => {
    exportToCSV(currentDataset.name, currentDataset.columns, filteredAndSortedRows);
    addToast('success', 'CSV Exported', `Downloaded ${filteredAndSortedRows.length} rows`);
  };

  const handleExportExcel = () => {
    exportToExcel(currentDataset.name, currentDataset.columns, filteredAndSortedRows);
    addToast('success', 'Excel File Downloaded', `Saved ${filteredAndSortedRows.length} rows as .xlsx`);
  };

  const handleCopyGoogleSheets = () => {
    const tsvText = copyToGoogleSheetsFormat(currentDataset.columns, filteredAndSortedRows);
    navigator.clipboard.writeText(tsvText);
    addToast('success', 'Copied to Clipboard!', 'Press Ctrl+V in Google Sheets to paste into exact headings');
  };

  const handleCopySelectedRows = (rowIds: string[]) => {
    const idSet = new Set(rowIds);
    const selectedRows = currentDataset.rows.filter(r => idSet.has(String(r._id)));
    const tsvText = copyToGoogleSheetsFormat(currentDataset.columns, selectedRows);
    navigator.clipboard.writeText(tsvText);
    addToast('success', 'Selected Rows Copied', `Ready to paste ${selectedRows.length} rows into Google Sheets`);
  };

  const handleUpdateTransactionRow = (rowId: string, updates: Record<string, any>) => {
    setDatasets(prev =>
      prev.map(d => {
        if (d.id === 'yatheem_transactions' || d.id === currentDataset.id) {
          const updated = {
            ...d,
            rows: d.rows.map(r => (r._id === rowId ? { ...r, ...updates } : r)),
            updatedAt: new Date().toISOString(),
          };
          saveDatasetToFirebase(updated).catch(err =>
            console.warn('Firebase update notice:', err)
          );
          return updated;
        }
        return d;
      })
    );
    addToast('success', 'Entry Updated!', 'Transaction details saved & synced');
  };

  const handleUpdateMultipleTransactionRows = (rowIds: string[], updates: Record<string, any>) => {
    const idSet = new Set(rowIds);
    setDatasets(prev =>
      prev.map(d => {
        if (d.id === 'yatheem_transactions' || d.id === currentDataset.id) {
          const updated = {
            ...d,
            rows: d.rows.map(r => (idSet.has(String(r._id)) ? { ...r, ...updates } : r)),
            updatedAt: new Date().toISOString(),
          };
          saveDatasetToFirebase(updated).catch(err =>
            console.warn('Firebase update notice:', err)
          );
          return updated;
        }
        return d;
      })
    );
    addToast('success', 'Records Updated!', `Updated ${rowIds.length} payment entries`);
  };

  const handleDeleteTransactionRow = (rowId: string) => {
    setDatasets(prev =>
      prev.map(d => {
        if (d.id === 'yatheem_transactions' || d.id === currentDataset.id) {
          const updated = {
            ...d,
            rows: d.rows.filter(r => String(r._id) !== rowId),
            updatedAt: new Date().toISOString(),
          };
          saveDatasetToFirebase(updated).catch(err =>
            console.warn('Firebase update notice:', err)
          );
          return updated;
        }
        return d;
      })
    );
    addToast('info', 'Payment Entry Deleted', 'Transaction removed & synced');
  };

  return (
    <div className="app-wrapper">
      <div className="bg-ambient-glow" />

      {/* Navigation Header */}
      <Header
        datasets={datasets}
        activeDatasetId={activeDatasetId}
        onSelectDataset={setActiveDatasetId}
        onOpenImportModal={() => setShowImportModal(true)}
        onOpenAddRowModal={() => setShowAddRowModal(true)}
        onLoadSample={(sample) => {
          if (!datasets.some(d => d.id === sample.id)) {
            setDatasets(prev => [sample, ...prev]);
          }
          setActiveDatasetId(sample.id);
          addToast('info', 'Sample Dataset Loaded', sample.name);
        }}
        onExportCSV={handleExportCSV}
        onExportExcel={handleExportExcel}
        onCopyGoogleSheets={handleCopyGoogleSheets}
        activeView={activeView}
        onChangeView={setActiveView}
        theme={theme}
        onToggleTheme={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
        sampleDatasets={[]}
        firebaseSyncStatus={firebaseSyncStatus}
      />

      {/* Filter, Search & Sorting Bar */}
      <FilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        columns={currentDataset.columns}
        filterRules={filterRules}
        onRemoveFilter={(id) => setFilterRules(prev => prev.filter(f => f.id !== id))}
        onClearAllFilters={() => {
          setFilterRules([]);
          setSearchQuery('');
          setSortRules([]);
          setGroupByColumn(undefined);
          addToast('info', 'Filters Cleared', 'Reset view to default');
        }}
        sortRules={sortRules}
        onOpenSortModal={() => setShowSortModal(true)}
        onOpenColumnModal={() => setShowColumnModal(true)}
        groupByColumn={groupByColumn}
        onGroupByChange={setGroupByColumn}
        totalRows={currentDataset.rows.length}
        filteredRowsCount={filteredAndSortedRows.length}
        onAddFilter={(rule) => setFilterRules(prev => [...prev, rule])}
      />

      {/* View Switcher: Dashboard | Sponsorship Matrix Report | Table | Grouped | Analytics */}
      <main style={{ flex: 1 }}>
        {activeView === 'dashboard' && (
          <Dashboard
            transactionDataset={
              datasets.find(d => d.id === 'yatheem_transactions') || currentDataset
            }
            slabs={slabs}
            slabAssignments={slabAssignments}
            onSlabsChange={handleSlabsChange}
            onAssignmentsChange={handleAssignmentsChange}
            onAddDonor={handleAddDonor}
            onUpdateTransactionRow={handleUpdateTransactionRow}
            onUpdateMultipleTransactionRows={handleUpdateMultipleTransactionRows}
            onDeleteTransactionRow={handleDeleteTransactionRow}
          />
        )}

        {activeView === 'sponsorship' && (
          <SponsorshipReport
            transactionDataset={
              datasets.find(d => d.id === 'yatheem_transactions') || currentDataset
            }
            masterDataset={undefined}
            allDatasets={datasets}
            slabs={slabs}
            slabAssignments={slabAssignments}
          />
        )}

        {activeView === 'table' && (
          <DataTable
            columns={currentDataset.columns}
            rows={filteredAndSortedRows}
            sortRules={sortRules}
            onToggleColumnSort={handleToggleColumnSort}
            onCellEdit={handleCellEdit}
            onDeleteRow={handleDeleteRow}
            onBulkDeleteRows={handleBulkDeleteRows}
            onCopySelectedRows={handleCopySelectedRows}
          />
        )}

        {activeView === 'grouped' && (
          <GroupedView
            columns={currentDataset.columns}
            rows={filteredAndSortedRows}
            groupByColumnId={groupByColumn}
            onSelectGroupBy={(colId) => setGroupByColumn(colId)}
          />
        )}

        {activeView === 'analytics' && (
          <AnalyticsDashboard
            columns={currentDataset.columns}
            rows={filteredAndSortedRows}
          />
        )}
      </main>

      {/* Modals */}
      {showSortModal && (
        <MultiSortModal
          columns={currentDataset.columns}
          sortRules={sortRules}
          onApplySort={(rules) => {
            setSortRules(rules);
            addToast('info', 'Sort Rules Applied', `Sorted by ${rules.length} column(s)`);
          }}
          onClose={() => setShowSortModal(false)}
        />
      )}

      {showColumnModal && (
        <ColumnManagerModal
          columns={currentDataset.columns}
          onUpdateColumns={handleUpdateColumns}
          onClose={() => setShowColumnModal(false)}
        />
      )}

      {showAddRowModal && (
        <AddRowModal
          columns={currentDataset.columns}
          onAddRow={handleAddRow}
          onClose={() => setShowAddRowModal(false)}
        />
      )}

      {showImportModal && (
        <ImportModal
          onImportDataset={handleImportDataset}
          onClose={() => setShowImportModal(false)}
        />
      )}

      {/* Toast Notifications Container */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
};
export default App;
