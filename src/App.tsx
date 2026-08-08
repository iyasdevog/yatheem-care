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
import {
  saveDatasetMetadataToFirebase,
  saveRowToFirebase,
  deleteRowFromFirebase,
  saveMultipleRowsToFirebase,
  subscribeToDatasetMetadata,
  subscribeToDatasetRows,
  migrateDatasetRowsIfNeeded,
} from './utils/firebaseSync';
import {
  loadSlabs,
  saveSlabs,
  loadSlabAssignments,
  saveSlabAssignments,
  assignDonorToSlab,
  saveSlabsToFirebase,
  saveAssignmentToFirebase,
  subscribeToSlabs,
  subscribeToAssignments,
  type DonationSlab,
  type SlabAssignment,
} from './utils/slabManager';
import { loadYatheemExcelWorkbook } from './utils/excelLoader';
import { DonorStandardizer } from './components/DonorStandardizer';
import {
  loadDonorAliasMap,
  saveDonorAliasMap,
  type DonorAliasMap,
} from './utils/donorReconciliation';
import { aggregateDonationData } from './utils/donationAggregator';

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
    saveSlabs(updated);          // localStorage (offline-first)
    setSlabs(updated);
    saveSlabsToFirebase(updated) // Firebase (background)
      .catch(err => console.warn('Slab Firebase sync error:', err));
  };

  const handleAssignmentsChange = (updated: SlabAssignment[]) => {
    saveSlabAssignments(updated);  // localStorage (offline-first)
    setSlabAssignments(updated);
    // Push each newly changed assignment to Firebase
    updated.forEach(a => {
      saveAssignmentToFirebase(a)
        .catch(err => console.warn('Assignment Firebase sync error:', err));
    });
  };

  // Donor Alias & Phone Linking map state
  const [aliasMap, setAliasMap] = useState<DonorAliasMap>(() => loadDonorAliasMap());

  const handleAliasMapChange = (updated: DonorAliasMap) => {
    saveDonorAliasMap(updated);
    setAliasMap(updated);
  };

  // Subscribe to Firebase slab & assignment changes (other devices / cloud edits)
  useEffect(() => {
    const unsubSlabs = subscribeToSlabs((remoteSlabs) => {
      setSlabs(prev => {
        // Only update if cloud has newer data than localStorage
        const localUpdated = prev.map(s => s.id).sort().join(',');
        const remoteUpdated = remoteSlabs.map(s => s.id).sort().join(',');
        return localUpdated !== remoteUpdated ? remoteSlabs : prev;
      });
    });
    const unsubAssignments = subscribeToAssignments((remoteAssignments) => {
      setSlabAssignments(remoteAssignments);
      saveSlabAssignments(remoteAssignments); // keep localStorage in sync
    });
    return () => { unsubSlabs(); unsubAssignments(); };
  }, []);

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

  // Auto-load 1-time Excel data from /Sponsors (Responses).xlsx if empty
  useEffect(() => {
    const hasData = datasets.some(d => d.rows.length > 0);
    if (!hasData) {
      loadYatheemExcelWorkbook().then(wb => {
        if (wb?.transactionDataset && wb.transactionDataset.rows.length > 0) {
          setDatasets([wb.transactionDataset]);
          saveDatasetMetadataToFirebase(wb.transactionDataset);
          saveMultipleRowsToFirebase(wb.transactionDataset.id, wb.transactionDataset.rows);
        }
      });
    }
  }, [datasets]);

  // ---- Firebase startup: migrate old data, subscribe to metadata + rows ----
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    // Step 1: run migration for all known datasets (safe no-op if already migrated)
    const knownDatasetIds = datasets.map(d => d.id);
    if (knownDatasetIds.length > 0) {
      Promise.all(knownDatasetIds.map(id => migrateDatasetRowsIfNeeded(id)))
        .catch(err => console.warn('Migration notice:', err));
    }

    // Step 2: Subscribe to dataset metadata changes from Firebase
    const unsubMeta = subscribeToDatasetMetadata((remoteMetaList) => {
      setDatasets(prev => {
        let changed = false;
        const updated = prev.map(p => {
          const remoteMeta = remoteMetaList.find(r => r.id === p.id);
          if (remoteMeta) {
            const remoteTime = new Date(remoteMeta.updatedAt).getTime();
            const localTime = new Date(p.updatedAt).getTime();
            if (remoteTime > localTime + 1000) {
              changed = true;
              return { ...p, ...remoteMeta }; // merge metadata, keep local rows
            }
          }
          return p;
        });
        // Add any brand-new datasets from remote that we don't have locally
        const prevIds = new Set(prev.map(p => p.id));
        const newFromRemote = remoteMetaList
          .filter(r => !prevIds.has(r.id))
          .map(r => ({ ...r, rows: [] } as Dataset));
        if (newFromRemote.length > 0) changed = true;
        return changed ? [...updated, ...newFromRemote] : prev;
      });
    });
    unsubscribers.push(unsubMeta);

    // Step 3: Subscribe to row-level changes for each dataset we know about
    knownDatasetIds.forEach(id => {
      const unsubRows = subscribeToDatasetRows(id, (remoteRows) => {
        setDatasets(prev => prev.map(d => {
          if (d.id !== id) return d;
          return { ...d, rows: remoteRows };
        }));
      });
      unsubscribers.push(unsubRows);
    });

    // Step 4: Push any local data (that may not have reached Firebase yet) as metadata + rows
    if (datasets.length > 0) {
      setFirebaseSyncStatus('syncing');
      const syncAll = datasets.map(async d => {
        await saveDatasetMetadataToFirebase(d);
        await saveMultipleRowsToFirebase(d.id, d.rows);
      });
      Promise.all(syncAll)
        .then(() => {
          setFirebaseSyncStatus('synced');
          setTimeout(() => setFirebaseSyncStatus('idle'), 3000);
        })
        .catch(err => {
          console.warn('Firebase initial sync notice:', err);
          setFirebaseSyncStatus('error');
        });
    }

    return () => unsubscribers.forEach(u => u());
  }, []);

  // View mode
  const [activeView, setActiveView] = useState<'dashboard' | 'sponsorship' | 'table' | 'grouped' | 'analytics' | 'standardizer'>('dashboard');

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

  // Helper to update current dataset metadata & sync to Firebase
  const updateCurrentDataset = (updater: (ds: Dataset) => Dataset) => {
    setDatasets(prev =>
      prev.map(d => {
        if (d.id === currentDataset.id) {
          const updated = updater(d);
          // Only metadata has changed (column schema, name, etc.) — no row sync needed
          saveDatasetMetadataToFirebase(updated).catch(err =>
            console.warn('Firebase metadata update notice:', err)
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

    // Granular Firebase write: only save the new row + update metadata timestamp
    setFirebaseSyncStatus('syncing');
    Promise.all([
      saveRowToFirebase(updatedDs.id, newRow),
      saveDatasetMetadataToFirebase(updatedDs),
    ])
      .then(() => {
        setFirebaseSyncStatus('synced');
        setTimeout(() => setFirebaseSyncStatus('idle'), 3000);
      })
      .catch((err) => {
        console.error('Firebase sync error:', err);
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
    // Granular Firebase write: save all rows in batches + metadata
    setFirebaseSyncStatus('syncing');
    Promise.all([
      saveDatasetMetadataToFirebase(newDs),
      saveMultipleRowsToFirebase(newDs.id, newDs.rows),
    ])
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
    const dsId = currentDataset.id === 'yatheem_transactions' ? 'yatheem_transactions' : currentDataset.id;
    setDatasets(prev =>
      prev.map(d => {
        if (d.id === dsId) {
          const updatedRow = { ...d.rows.find(r => r._id === rowId), ...updates } as RowData;
          const updated = {
            ...d,
            rows: d.rows.map(r => (r._id === rowId ? updatedRow : r)),
            updatedAt: new Date().toISOString(),
          };
          // Only push the single changed row to Firebase
          setFirebaseSyncStatus('syncing');
          saveRowToFirebase(dsId, updatedRow)
            .then(() => {
              setFirebaseSyncStatus('synced');
              setTimeout(() => setFirebaseSyncStatus('idle'), 3000);
            })
            .catch(err => {
              console.warn('Firebase update notice:', err);
              setFirebaseSyncStatus('error');
            });
          return updated;
        }
        return d;
      })
    );
    addToast('success', 'Entry Updated!', 'Transaction details saved & synced');
  };

  const handleUpdateMultipleTransactionRows = (rowIds: string[], updates: Record<string, any>) => {
    const idSet = new Set(rowIds);
    const dsId = currentDataset.id;
    setDatasets(prev =>
      prev.map(d => {
        if (d.id === dsId) {
          const updatedRows = d.rows.map(r => (idSet.has(String(r._id)) ? { ...r, ...updates } : r));
          const updated = { ...d, rows: updatedRows, updatedAt: new Date().toISOString() };
          // Save only the changed rows in a single batch
          const changedRows = updatedRows.filter(r => idSet.has(String(r._id)));
          setFirebaseSyncStatus('syncing');
          saveMultipleRowsToFirebase(dsId, changedRows)
            .then(() => {
              setFirebaseSyncStatus('synced');
              setTimeout(() => setFirebaseSyncStatus('idle'), 3000);
            })
            .catch(err => {
              console.warn('Firebase batch update notice:', err);
              setFirebaseSyncStatus('error');
            });
          return updated;
        }
        return d;
      })
    );
    addToast('success', 'Records Updated!', `Updated ${rowIds.length} payment entries`);
  };

  const handleDeleteTransactionRow = (rowId: string) => {
    const dsId = currentDataset.id;
    setDatasets(prev =>
      prev.map(d => {
        if (d.id === dsId) {
          const updated = {
            ...d,
            rows: d.rows.filter(r => String(r._id) !== rowId),
            updatedAt: new Date().toISOString(),
          };
          // Only delete the single row document from Firestore
          setFirebaseSyncStatus('syncing');
          deleteRowFromFirebase(dsId, rowId)
            .then(() => {
              setFirebaseSyncStatus('synced');
              setTimeout(() => setFirebaseSyncStatus('idle'), 3000);
            })
            .catch(err => {
              console.warn('Firebase delete notice:', err);
              setFirebaseSyncStatus('error');
            });
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
        onOpenImportModal={() => setShowImportModal(true)}
        onOpenAddRowModal={() => setShowAddRowModal(true)}
        onExportCSV={handleExportCSV}
        onExportExcel={handleExportExcel}
        onCopyGoogleSheets={handleCopyGoogleSheets}
        activeView={activeView}
        onChangeView={setActiveView}
        theme={theme}
        onToggleTheme={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
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
            aliasMap={aliasMap}
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
            aliasMap={aliasMap}
          />
        )}

        {activeView === 'standardizer' && (
          <DonorStandardizer
            donorRecords={
              aggregateDonationData(
                (datasets.find(d => d.id === 'yatheem_transactions') || currentDataset).rows,
                [],
                slabAssignments,
                slabs,
                undefined,
                aliasMap
              ).donorsByPhone
            }
            aliasMap={aliasMap}
            onAliasMapChange={handleAliasMapChange}
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
