import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className="toast glass-panel">
          {toast.type === 'success' && <CheckCircle2 className="text-emerald-400" size={20} />}
          {toast.type === 'error' && <AlertCircle className="text-red-400" size={20} />}
          {toast.type === 'info' && <Info className="text-indigo-400" size={20} />}

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{toast.title}</div>
            {toast.message && (
              <div style={{ fontSize: '0.78125rem', color: 'var(--text-secondary)' }}>
                {toast.message}
              </div>
            )}
          </div>

          <button
            className="btn btn-ghost btn-sm btn-icon"
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss toast"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
