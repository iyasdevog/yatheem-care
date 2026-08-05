import React, { useState } from 'react';
import { Upload, FileSpreadsheet, Clipboard, X, Sparkles } from 'lucide-react';
import type { Dataset } from '../types/data';
import { createDatasetFromRaw, parseCSVOrTSVText, parseExcelBuffer } from '../utils/csvParser';

interface ImportModalProps {
  onImportDataset: (dataset: Dataset) => void;
  onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ onImportDataset, onClose }) => {
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [datasetName, setDatasetName] = useState('Imported Google Form Responses');
  const [pasteText, setPasteText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // File Upload handler
  const handleFileUpload = async (file: File) => {
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const fileNameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      const name = fileNameWithoutExt || 'Imported Form Data';

      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const { headers, rows } = parseExcelBuffer(buffer);
        if (headers.length === 0) throw new Error('No data or headers found in Excel file');
        const dataset = createDatasetFromRaw(name, headers, rows, 'google_sheet');
        onImportDataset(dataset);
        onClose();
      } else {
        const text = await file.text();
        const { headers, rows } = await parseCSVOrTSVText(text);
        if (headers.length === 0) throw new Error('No valid CSV/TSV headers found in file');
        const dataset = createDatasetFromRaw(name, headers, rows, 'csv');
        onImportDataset(dataset);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to parse uploaded file');
    } finally {
      setIsProcessing(false);
    }
  };

  // Paste Text handler
  const handlePasteImport = async () => {
    if (!pasteText.trim()) return;
    setIsProcessing(true);
    setErrorMsg(null);

    try {
      const { headers, rows } = await parseCSVOrTSVText(pasteText);
      if (headers.length === 0 || rows.length === 0) {
        throw new Error('Unable to detect headers or tabular rows from pasted text');
      }
      const dataset = createDatasetFromRaw(datasetName.trim() || 'Pasted Form Data', headers, rows, 'google_form');
      onImportDataset(dataset);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process pasted text');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        
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
              <Upload size={20} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Import Google Form / Sheet Data</h3>
              <p style={{ fontSize: '0.78125rem', color: 'var(--text-muted)' }}>
                Upload exported CSV, Excel (.xlsx) files or paste copied rows
              </p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <button
              className={`btn btn-sm ${tab === 'file' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab('file')}
            >
              <FileSpreadsheet size={16} /> File Upload (.csv, .xlsx, .tsv)
            </button>
            <button
              className={`btn btn-sm ${tab === 'paste' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab('paste')}
            >
              <Clipboard size={16} /> Direct Copy-Paste
            </button>
          </div>

          {errorMsg && (
            <div className="badge badge-danger" style={{ padding: '0.5rem 0.85rem', width: '100%' }}>
              {errorMsg}
            </div>
          )}

          {tab === 'file' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  border: '2px dashed var(--accent-primary)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  background: 'var(--bg-primary)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv, .tsv, .xlsx, .xls';
                  input.onchange = (e: any) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  };
                  input.click();
                }}
              >
                <Upload size={36} className="text-indigo-400" style={{ margin: '0 auto 0.75rem auto' }} />
                <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>Click to choose or drag & drop file</h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Supports Google Forms CSV exports, TSV, and Microsoft Excel (.xlsx) files
                </p>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Dataset Name
                </label>
                <input
                  type="text"
                  className="input-field"
                  value={datasetName}
                  onChange={(e) => setDatasetName(e.target.value)}
                  placeholder="e.g. Google Form Responses - August 2026"
                  style={{ marginTop: '0.25rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Paste Google Sheet / Form Data (Tabular TSV or CSV text)
                </label>
                <textarea
                  className="input-field"
                  rows={8}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', marginTop: '0.25rem' }}
                  placeholder="Paste headers and rows directly copied from Google Sheets..."
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {tab === 'paste' && (
            <button className="btn btn-primary" onClick={handlePasteImport} disabled={isProcessing}>
              <Sparkles size={16} /> Import & Parse Data
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
