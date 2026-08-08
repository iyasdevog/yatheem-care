import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Building2,
  ChevronRight,
  Plus,
  Search,
  X,
  ArrowRight,
  Heart,
  UserPlus,
  Tag,
  Pencil,
  Calendar,
  ArrowUpDown,
  Trash2,
  Check,
} from 'lucide-react';
import type { Dataset } from '../types/data';
import { aggregateDonationData, type DonorRecord, type CareOfSummary, type TransactionEntry, type DateRangeFilter } from '../utils/donationAggregator';
import {
  type DonationSlab,
  type SlabAssignment,
  DEFAULT_SLABS,
} from '../utils/slabManager';
import { SlabManager } from './SlabManager';

interface DashboardProps {
  transactionDataset: Dataset;
  slabs: DonationSlab[];
  slabAssignments: SlabAssignment[];
  onSlabsChange: (slabs: DonationSlab[]) => void;
  onAssignmentsChange: (assignments: SlabAssignment[]) => void;
  onAddDonor: (donor: NewDonorForm) => void;
  onUpdateTransactionRow?: (rowId: string, updates: Record<string, any>) => void;
  onUpdateMultipleTransactionRows?: (rowIds: string[], updates: Record<string, any>) => void;
  onDeleteTransactionRow?: (rowId: string) => void;
}

export interface NewDonorForm {
  name: string;
  phone: string;
  careOf: string;
  address: string;
  sponsorshipAmount: number;
  sponsorshipCategory: string;
  startDate: string;
  slabId?: string;
  slabUnits?: number;
}

type DrillDown = 
  | { view: 'home' }
  | { view: 'donor_detail'; donor: DonorRecord }
  | { view: 'careof_detail'; co: CareOfSummary }
  | { view: 'add_donor' }
  | { view: 'search_results'; query: string }
  | { view: 'status_list'; status: 'started' | 'not_started' | 'expiring' | 'fully_paid' };

function formatINR(amount: number) {
  return '₹' + amount.toLocaleString('en-IN');
}

function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    'Donation Started': '#10b981',
    'Not Started Yet': '#f59e0b',
    'Fully Paid': '#6366f1',
    'Expiring Soon (1-Year)': '#ef4444',
  };
  return (
    <span style={{
      display: 'inline-block',
      width: 8, height: 8,
      borderRadius: '50%',
      background: map[status] || '#94a3b8',
      flexShrink: 0,
    }} />
  );
}

// ── ADD DONOR MODAL ──────────────────────────────────────────────────────────
function AddDonorSheet({ onClose, onSubmit, existingCareOfs, existingDonors, slabs = [] }: {
  onClose: () => void;
  onSubmit: (form: NewDonorForm) => void;
  existingCareOfs: string[];
  existingDonors: { phone: string; name: string; careOf: string }[];
  slabs?: DonationSlab[];
}) {
  const activeSlabs = slabs.length > 0 ? slabs : DEFAULT_SLABS;
  const initialSlab = activeSlabs[0];

  const [form, setForm] = useState<NewDonorForm>({
    name: '',
    phone: '',
    careOf: '',
    address: '',
    sponsorshipAmount: initialSlab ? initialSlab.amount : 50000,
    sponsorshipCategory: initialSlab ? `${initialSlab.category} – ${initialSlab.label} (${formatINR(initialSlab.amount)})` : 'Education – Full',
    startDate: new Date().toISOString().slice(0, 10),
    slabId: initialSlab?.id,
    slabUnits: 1,
  });
  const [customAmt, setCustomAmt] = useState(false);
  const [step, setStep] = useState(1);

  const set = (k: keyof NewDonorForm, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handlePhoneChange = (val: string) => {
    set('phone', val);
    // Auto-fill donor name & careOf if matching an existing phone
    const matched = existingDonors.find(d => d.phone === val || (val.length >= 8 && d.phone.endsWith(val.slice(-8))));
    if (matched) {
      if (!form.name) set('name', matched.name);
      if (!form.careOf) set('careOf', matched.careOf || 'Direct');
    }
  };

  const handleSelectSlab = (s: DonationSlab) => {
    setCustomAmt(false);
    const units = form.slabUnits || 1;
    setForm(f => ({
      ...f,
      slabId: s.id,
      sponsorshipAmount: s.amount * units,
      sponsorshipCategory: `${s.category} – ${s.label} (${formatINR(s.amount)})`,
    }));
  };

  const handleCustomSponsor = () => {
    setCustomAmt(true);
    setForm(f => ({
      ...f,
      slabId: undefined,
      sponsorshipAmount: f.sponsorshipAmount || 0,
      sponsorshipCategory: 'Custom Sponsorship',
    }));
  };

  const handleUnitsChange = (newUnits: number) => {
    const validUnits = Math.max(1, newUnits);
    const selectedSlab = activeSlabs.find(s => s.id === form.slabId);
    setForm(f => ({
      ...f,
      slabUnits: validUnits,
      sponsorshipAmount: selectedSlab ? selectedSlab.amount * validUnits : f.sponsorshipAmount,
    }));
  };

  const selectedSlabObj = activeSlabs.find(s => s.id === form.slabId);
  const canProceed1 = form.name.trim().length > 1;
  const canProceed2 = form.sponsorshipAmount > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Add New Donor</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Step {step} of 3</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 0, padding: '0 1.5rem' }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              flex: 1,
              height: 3,
              background: s <= step ? 'var(--accent-primary)' : 'var(--border-color)',
              borderRadius: 2,
              margin: '0 2px',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        <div className="modal-body">
          {/* Step 1 – Identity */}
          {step === 1 && (
            <>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  Phone / Contact Number (Type or pick existing)
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. 9946012345 or pick existing"
                  value={form.phone}
                  onChange={e => handlePhoneChange(e.target.value)}
                  list="phone-suggestions"
                  type="tel"
                  autoFocus
                />
                <datalist id="phone-suggestions">
                  {existingDonors.map((d, i) => (
                    <option key={i} value={d.phone} label={`${d.name} (${d.careOf || 'Direct'})`} />
                  ))}
                </datalist>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  Donor Name *
                </label>
                <input
                  className="input-field"
                  placeholder="Full name of donor"
                  value={form.name}
                  onChange={e => set('name', e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  Care Of (C/O) – Referral Agent
                </label>
                <input
                  className="input-field"
                  placeholder="Pick 'Direct' or type C/O name..."
                  value={form.careOf}
                  onChange={e => set('careOf', e.target.value)}
                  list="careof-suggestions"
                />
                <datalist id="careof-suggestions">
                  <option value="Direct" label="Direct (No Referrer)" />
                  {existingCareOfs.map(c => <option key={c} value={c} />)}
                </datalist>

                {/* Quick C/O Pill Shortcuts */}
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Quick pick:</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', border: form.careOf === 'Direct' ? '1px solid var(--accent-primary)' : '1px dashed var(--border-color)', background: form.careOf === 'Direct' ? 'rgba(99,102,241,0.15)' : undefined }}
                    onClick={() => set('careOf', 'Direct')}
                  >
                    Direct
                  </button>
                  {existingCareOfs.slice(0, 4).map(c => (
                    <button
                      key={c}
                      type="button"
                      className="btn btn-sm btn-ghost"
                      style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem', border: form.careOf === c ? '1px solid var(--accent-primary)' : '1px dashed var(--border-color)', background: form.careOf === c ? 'rgba(99,102,241,0.15)' : undefined }}
                      onClick={() => set('careOf', c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  Address / Location
                </label>
                <input
                  className="input-field"
                  placeholder="Village / Area / Place"
                  value={form.address}
                  onChange={e => set('address', e.target.value)}
                />
              </div>
            </>
          )}

          {/* Step 2 – Sponsorship & Slab Multiplier */}
          {step === 2 && (
            <>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
                  Sponsorship Slab *
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                  {activeSlabs.map(s => {
                    const isSelected = !customAmt && form.slabId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSelectSlab(s)}
                        style={{
                          padding: '0.75rem 1rem',
                          borderRadius: 'var(--radius-md)',
                          border: `1.5px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                          background: isSelected ? 'rgba(99,102,241,0.15)' : 'var(--bg-tertiary)',
                          color: '#ffffff',
                          cursor: 'pointer',
                          textAlign: 'left',
                          fontWeight: 700,
                          fontSize: '0.875rem',
                          fontFamily: 'inherit',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.2s',
                        }}
                      >
                        <div>
                          <span>{s.category} – {s.label}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 8 }}>
                            ({formatINR(s.amount)} / {s.unit})
                          </span>
                        </div>
                        {isSelected && <Check size={18} color="var(--accent-primary)" />}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={handleCustomSponsor}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      border: `1.5px solid ${customAmt ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                      background: customAmt ? 'rgba(99,102,241,0.15)' : 'var(--bg-tertiary)',
                      color: '#ffffff',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: 700,
                      fontSize: '0.875rem',
                      fontFamily: 'inherit',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>Custom Amount</span>
                    {customAmt && <Check size={18} color="var(--accent-primary)" />}
                  </button>
                </div>
              </div>

              {/* Slab Count / Quantity Selector */}
              {!customAmt && form.slabId && selectedSlabObj && (
                <div style={{ marginTop: '0.85rem', padding: '1rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8 }}>
                    Slab Quantity / Count (e.g. 3 × {formatINR(selectedSlabObj.amount)})
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Quick Pick Pills */}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[1, 2, 3, 4, 5].map(cnt => (
                        <button
                          key={cnt}
                          type="button"
                          className="btn btn-sm"
                          style={{
                            minWidth: 40,
                            fontWeight: 800,
                            background: form.slabUnits === cnt ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                            color: form.slabUnits === cnt ? '#ffffff' : 'var(--text-primary)',
                            border: form.slabUnits === cnt ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                          }}
                          onClick={() => handleUnitsChange(cnt)}
                        >
                          {cnt}x
                        </button>
                      ))}
                    </div>

                    {/* Stepper buttons & Custom Count Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.65rem', fontWeight: 800 }}
                        onClick={() => handleUnitsChange((form.slabUnits || 1) - 1)}
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min={1}
                        className="input-field"
                        style={{ width: 64, textAlign: 'center', fontWeight: 800, padding: '0.35rem 0.5rem' }}
                        value={form.slabUnits || 1}
                        onChange={e => handleUnitsChange(parseInt(e.target.value) || 1)}
                      />
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '0.25rem 0.65rem', fontWeight: 800 }}
                        onClick={() => handleUnitsChange((form.slabUnits || 1) + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Calculation summary banner */}
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      Calculation: <strong>{form.slabUnits || 1}</strong> × {formatINR(selectedSlabObj.amount)}
                    </span>
                    <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#10b981' }}>
                      Target: {formatINR(form.sponsorshipAmount)}
                    </span>
                  </div>
                </div>
              )}

              {customAmt && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                    Custom Amount (₹)
                  </label>
                  <input
                    className="input-field"
                    type="number"
                    placeholder="Enter custom amount"
                    value={form.sponsorshipAmount || ''}
                    onChange={e => set('sponsorshipAmount', Number(e.target.value))}
                    autoFocus
                  />
                </div>
              )}
            </>
          )}

          {/* Step 3 – Start Date & Confirm */}
          {step === 3 && (
            <>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
                  Sponsorship Start Date
                </label>
                <input
                  className="input-field"
                  type="date"
                  value={form.startDate}
                  onChange={e => set('startDate', e.target.value)}
                />
              </div>
              {/* Summary */}
              <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', marginBottom: 4 }}>Confirm Details</p>
                {[
                  ['Name', form.name],
                  ['Phone', form.phone || 'Not provided'],
                  ['Care Of (C/O)', form.careOf || 'Direct / Unassigned'],
                  ['Address', form.address || '—'],
                  ['Sponsorship Slab', form.sponsorshipCategory],
                  ['Slab Quantity / Count', `${form.slabUnits || 1} unit(s)`],
                  ['Committed Target', formatINR(form.sponsorshipAmount)],
                  ['Start Date', form.startDate],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                    <span style={{ color: '#cbd5e1' }}>{k}</span>
                    <span style={{ fontWeight: 700, color: '#ffffff' }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          {step > 1 && (
            <button className="btn btn-secondary" onClick={() => setStep(s => s - 1)}>Back</button>
          )}
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          {step < 3 ? (
            <button
              className="btn btn-primary"
              disabled={step === 1 ? !canProceed1 : !canProceed2}
              onClick={() => setStep(s => s + 1)}
            >
              Continue <ArrowRight size={16} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => { onSubmit(form); onClose(); }}
            >
              <Heart size={16} /> Add Donor
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── EDIT DONOR PROFILE MODAL ──────────────────────────────────────────────────
function EditDonorProfileModal({
  donor,
  existingCareOfs,
  onClose,
  onSave,
}: {
  donor: DonorRecord;
  existingCareOfs: string[];
  onClose: () => void;
  onSave: (updates: { name: string; phone: string; careOf: string; address?: string; remarks?: string; startDate?: string }) => void;
}) {
  const [name, setName] = useState(donor.donorName);
  const [phone, setPhone] = useState(donor.phoneNumber === 'N/A' ? '' : donor.phoneNumber);
  const [careOf, setCareOf] = useState(donor.careOf);
  const [address, setAddress] = useState(donor.address || '');
  const [remarks, setRemarks] = useState(donor.remarks || '');
  const [startDate, setStartDate] = useState(
    donor.startDate ? donor.startDate.toISOString().split('T')[0] : ''
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pencil size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Edit Donor Profile</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Update details across all {donor.transactionCount} payments</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Donor / Donee Name
            </label>
            <input
              className="input-field"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full name of donor or donee"
              autoFocus
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Mobile / Contact Number
              </label>
              <input
                className="input-field"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 9544444114"
                type="tel"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Start Date
              </label>
              <input
                type="date"
                className="input-field"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Care Of (C/O)
            </label>
            <input
              className="input-field"
              value={careOf}
              onChange={e => setCareOf(e.target.value)}
              placeholder="Direct or Referral agent"
              list="edit-donor-co-list"
            />
            <datalist id="edit-donor-co-list">
              <option value="Direct" />
              {existingCareOfs.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Address / Place
            </label>
            <input
              className="input-field"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="City, village or place"
            />
          </div>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Remarks / Notes
            </label>
            <input
              className="input-field"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="Special notes or sponsorship remarks"
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onSave({
                name: name.trim(),
                phone: phone.trim(),
                careOf: careOf.trim(),
                address: address.trim(),
                remarks: remarks.trim(),
                startDate: startDate || undefined,
              });
              onClose();
            }}
          >
            Save Profile Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── EDIT TRANSACTION ENTRY MODAL ─────────────────────────────────────────────
function EditTransactionModal({
  tx,
  existingCareOfs,
  onClose,
  onSave,
  onDelete,
}: {
  tx: TransactionEntry;
  existingCareOfs: string[];
  onClose: () => void;
  onSave: (updates: { name: string; phone: string; careOf: string; amount: number; mode: string; voucherNo: string; date?: string }) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(tx.name);
  const [phone, setPhone] = useState(tx.contact1 || tx.contact2 || '');
  const [careOf, setCareOf] = useState(tx.careOf);
  const [amount, setAmount] = useState(tx.amount);
  const [mode, setMode] = useState(tx.mode);
  const [voucherNo, setVoucherNo] = useState(tx.voucherNo);
  const [date, setDate] = useState(
    tx.dateObj ? tx.dateObj.toISOString().split('T')[0] : ''
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pencil size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Edit Payment Entry</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Voucher #{tx.voucherNo}</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              Donee / Donor Name (this payment)
            </label>
            <input
              className="input-field"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Donee or donor name"
              autoFocus
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Mobile / Contact Number
              </label>
              <input
                className="input-field"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="e.g. 9544444114"
                type="tel"
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Payment Date
              </label>
              <input
                type="date"
                className="input-field"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Amount (₹)
              </label>
              <input
                className="input-field"
                type="number"
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Payment Mode
              </label>
              <input
                className="input-field"
                value={mode}
                onChange={e => setMode(e.target.value)}
                placeholder="Cash, GPay, Bank, UPI"
              />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Care Of (C/O)
              </label>
              <input
                className="input-field"
                value={careOf}
                onChange={e => setCareOf(e.target.value)}
                placeholder="Direct"
                list="tx-edit-co-list"
              />
              <datalist id="tx-edit-co-list">
                <option value="Direct" />
                {existingCareOfs.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Voucher No
              </label>
              <input
                className="input-field"
                value={voucherNo}
                onChange={e => setVoucherNo(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          {onDelete && !confirmDelete ? (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ color: '#ef4444' }}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={14} style={{ marginRight: 4 }} /> Delete
            </button>
          ) : onDelete && confirmDelete ? (
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: '#ef4444', borderColor: '#ef4444' }}
              onClick={() => { onDelete(); onClose(); }}
            >
              Confirm Delete?
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => {
                onSave({
                  name: name.trim(),
                  phone: phone.trim(),
                  careOf: careOf.trim(),
                  amount: Number(amount),
                  mode: mode.trim(),
                  voucherNo: voucherNo.trim(),
                  date,
                });
                onClose();
              }}
            >
              Save Payment Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EDIT CARE OF GROUP MODAL ─────────────────────────────────────────────────
function EditCareOfModal({
  careOfName,
  onClose,
  onSave,
}: {
  careOfName: string;
  onClose: () => void;
  onSave: (newName: string) => void;
}) {
  const [name, setName] = useState(careOfName);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pencil size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Rename Care Of (C/O)</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Updates all donors under "{careOfName}"</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
              New Care Of Group Name
            </label>
            <input
              className="input-field"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. VP Abdullah"
              autoFocus
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            disabled={!name.trim() || name.trim() === careOfName}
            onClick={() => {
              onSave(name.trim());
              onClose();
            }}
          >
            Rename Group
          </button>
        </div>
      </div>
    </div>
  );
}

// ── DONOR DETAIL PANEL ───────────────────────────────────────────────────────
function DonorDetail({
  donor,
  onBack,
  existingCareOfs,
  onUpdateDonor,
  onUpdateTx,
  onDeleteTx,
}: {
  donor: DonorRecord;
  onBack: () => void;
  existingCareOfs: string[];
  onUpdateDonor: (donor: DonorRecord, updates: { name: string; phone: string; careOf: string; address?: string; remarks?: string; startDate?: string }) => void;
  onUpdateTx: (txId: string, updates: Record<string, any>) => void;
  onDeleteTx?: (txId: string) => void;
}) {
  const [showEditDonor, setShowEditDonor] = useState(false);
  const [editingTx, setEditingTx] = useState<TransactionEntry | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const balancePct = donor.totalCommitted > 0
    ? Math.min(100, Math.round((donor.totalPaid / donor.totalCommitted) * 100))
    : 100;

  const sortedTransactions = useMemo(() => {
    return [...donor.transactions].sort((a, b) => {
      const timeA = a.dateObj?.getTime() ?? 0;
      const timeB = b.dateObj?.getTime() ?? 0;
      return sortAsc ? timeA - timeB : timeB - timeA;
    });
  }, [donor.transactions, sortAsc]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Back + title + Edit button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back</button>
          <h2 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 800 }}>{donor.donorName || donor.phoneNumber}</h2>
          <span className={`badge ${donor.statusInfo.badgeClass}`}>{donor.statusInfo.label}</span>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setShowEditDonor(true)}
        >
          <Pencil size={14} /> Edit Profile
        </button>
      </div>

      {/* Key metrics (Clickable to edit) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Phone', value: donor.phoneNumber, color: '#3b82f6', editable: true },
          { label: 'Care Of', value: donor.careOf || '—', color: 'var(--text-primary)', editable: true },
          { label: 'Start Date', value: donor.startDateFormatted, color: 'var(--text-primary)', editable: true },
          { label: '1-Year End', value: donor.endDateFormatted, color: '#f59e0b', editable: false },
          { label: 'Total Paid', value: formatINR(donor.totalPaid), color: '#10b981', editable: false },
          { label: 'Balance', value: formatINR(donor.balanceRemaining), color: donor.balanceRemaining > 0 ? '#f59e0b' : '#10b981', editable: false },
        ].map(({ label, value, color, editable }) => (
          <div
            key={label}
            className="glass-panel"
            style={{ padding: '0.875rem 1rem', cursor: editable ? 'pointer' : 'default' }}
            onClick={() => editable && setShowEditDonor(true)}
            title={editable ? 'Click to edit' : undefined}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{label}</span>
              {editable && <Pencil size={10} color="var(--text-muted)" />}
            </div>
            <div style={{ fontWeight: 800, color, fontSize: '0.95rem' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: '0.85rem' }}>
          <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Payment Progress</span>
          <span style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>{balancePct}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${balancePct}%`, background: 'var(--accent-gradient)', borderRadius: 4, transition: 'width 0.5s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          <span>Paid: {formatINR(donor.totalPaid)}</span>
          <span>Target: {formatINR(donor.totalCommitted)}</span>
        </div>
      </div>

      {/* Transaction history */}
      <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: 6 }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Payment History ({donor.transactionCount} entries)
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSortAsc(!sortAsc)}
            style={{ fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px' }}
          >
            <ArrowUpDown size={12} /> {sortAsc ? 'Oldest First ⬆' : 'Newest First ⬇'}
          </button>
        </div>
        {sortedTransactions.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>No payments recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sortedTransactions.map((tx, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0.875rem', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{tx.date}</span>
                    {tx.name && tx.name !== 'Unknown' && (
                      <span style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                        {tx.name}
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 3 }}>
                    Mode: {tx.mode} · Voucher #{tx.voucherNo} · C/O: {tx.careOf || 'Direct'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, color: '#10b981', fontSize: '0.95rem' }}>{formatINR(tx.amount)}</div>
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => setEditingTx(tx)}
                    title="Edit payment entry"
                    style={{ padding: 4 }}
                  >
                    <Pencil size={14} color="var(--text-muted)" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showEditDonor && (
        <EditDonorProfileModal
          donor={donor}
          existingCareOfs={existingCareOfs}
          onClose={() => setShowEditDonor(false)}
          onSave={updates => onUpdateDonor(donor, updates)}
        />
      )}

      {editingTx && (
        <EditTransactionModal
          tx={editingTx}
          existingCareOfs={existingCareOfs}
          onClose={() => setEditingTx(null)}
          onDelete={() => onDeleteTx && onDeleteTx(editingTx.id)}
          onSave={updates => {
            const rowUpdates: Record<string, any> = {};
            if (updates.name !== undefined) { rowUpdates['Name'] = updates.name; rowUpdates['NAME'] = updates.name; }
            if (updates.phone !== undefined) { rowUpdates['Contact 1'] = updates.phone; rowUpdates['PHONE NUMBER'] = updates.phone; rowUpdates['Phone Number'] = updates.phone; }
            if (updates.careOf !== undefined) { rowUpdates['C/O'] = updates.careOf; rowUpdates['Care Of'] = updates.careOf; rowUpdates['CARE OF'] = updates.careOf; }
            if (updates.amount !== undefined) { rowUpdates['Amount'] = updates.amount; rowUpdates['Amount '] = updates.amount; rowUpdates['AMOUNT'] = updates.amount; }
            if (updates.mode !== undefined) { rowUpdates['MODE'] = updates.mode; rowUpdates['Mode'] = updates.mode; }
            if (updates.voucherNo !== undefined) { rowUpdates['Voucher no'] = updates.voucherNo; rowUpdates['Voucher No'] = updates.voucherNo; rowUpdates['VOUCHER NO'] = updates.voucherNo; }
            if (updates.date !== undefined) { rowUpdates['Date'] = updates.date; rowUpdates['DATE'] = updates.date; }

            onUpdateTx(editingTx.id, rowUpdates);
          }}
        />
      )}
    </div>
  );
}

// ── CARE OF DETAIL PANEL ─────────────────────────────────────────────────────
function CareOfDetail({
  co,
  onBack,
  onSelectDonor,
  onRenameCareOf,
}: {
  co: CareOfSummary;
  onBack: () => void;
  onSelectDonor: (d: DonorRecord) => void;
  onRenameCareOf: (co: CareOfSummary, newName: string) => void;
}) {
  const [showRename, setShowRename] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back</button>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>C/O: {co.careOfName}</h2>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          onClick={() => setShowRename(true)}
        >
          <Pencil size={14} /> Rename C/O
        </button>
      </div>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
        {[
          { label: 'Donors', value: co.donorCount, color: 'var(--text-primary)' },
          { label: 'Collected', value: formatINR(co.totalCollected), color: '#10b981' },
          { label: 'Target', value: formatINR(co.totalCommitted), color: 'var(--accent-primary)' },
          { label: 'Balance', value: formatINR(co.balanceRemaining), color: '#f59e0b' },
        ].map(({ label, value, color }) => (
          <div key={label} className="glass-panel" style={{ padding: '0.875rem 1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="glass-panel" style={{ padding: '0.875rem 1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.85rem' }}>
          <span>Collection Progress</span>
          <span style={{ fontWeight: 800, color: 'var(--accent-primary)' }}>{co.progressPercent}%</span>
        </div>
        <div style={{ height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${co.progressPercent}%`, background: 'var(--accent-gradient)', borderRadius: 4 }} />
        </div>
      </div>

      {/* Donors list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h3 style={{ fontSize: '0.9rem' }}>All Donors under this C/O</h3>
        {co.donors.map(d => (
          <button
            key={d.id}
            onClick={() => onSelectDonor(d)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit', transition: 'background 0.2s' }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{d.donorName || d.phoneNumber}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>{d.phoneNumber} · {d.sponsorshipCategory}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, color: '#10b981', fontSize: '0.95rem' }}>{formatINR(d.totalPaid)}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Bal: {formatINR(d.balanceRemaining)}</div>
            </div>
          </button>
        ))}
      </div>

      {showRename && (
        <EditCareOfModal
          careOfName={co.careOfName}
          onClose={() => setShowRename(false)}
          onSave={newName => onRenameCareOf(co, newName)}
        />
      )}
    </div>
  );
}

// ── STATUS LIST PANEL ────────────────────────────────────────────────────────
function StatusList({ donors, status, onBack, onSelectDonor }: {
  donors: DonorRecord[];
  status: string;
  onBack: () => void;
  onSelectDonor: (d: DonorRecord) => void;
}) {
  const [q, setQ] = useState('');
  const filtered = donors.filter(d =>
    !q || d.donorName.toLowerCase().includes(q.toLowerCase()) || d.phoneNumber.includes(q)
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back</button>
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>{status} ({donors.length})</h2>
      </div>
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
        <input className="input-field" style={{ paddingLeft: 36 }} placeholder="Search name or phone..." value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map(d => (
          <button key={d.id} onClick={() => onSelectDonor(d)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit' }}>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{d.donorName || d.phoneNumber}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <StatusDot status={d.statusInfo.label} />
                {d.statusInfo.label} · {d.phoneNumber}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontWeight: 800, color: '#10b981', fontSize: '0.9rem' }}>{formatINR(d.totalPaid)}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Bal {formatINR(d.balanceRemaining)}</div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem' }}>No results found.</p>}
      </div>
    </div>
  );
}

// ── SEARCH RESULTS PANEL ─────────────────────────────────────────────────────
function SearchResults({ donors, careOfs, query, onBack, onSelectDonor, onSelectCareOf }: {
  donors: DonorRecord[];
  careOfs: CareOfSummary[];
  query: string;
  onBack: () => void;
  onSelectDonor: (d: DonorRecord) => void;
  onSelectCareOf: (co: CareOfSummary) => void;
}) {
  const q = query.toLowerCase();
  const matchedDonors = donors.filter(d =>
    d.donorName.toLowerCase().includes(q) ||
    d.phoneNumber.includes(q) ||
    d.rawPhone.includes(q) ||
    d.careOf.toLowerCase().includes(q) ||
    d.transactions.some(t => t.voucherNo.toLowerCase().includes(q))
  );
  const matchedCareOfs = careOfs.filter(co => co.careOfName.toLowerCase().includes(q));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={onBack}>← Back</button>
        <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Results for "{query}"</h2>
      </div>

      {matchedDonors.length > 0 && (
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Donors ({matchedDonors.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {matchedDonors.map(d => (
              <button key={d.id} onClick={() => onSelectDonor(d)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{d.donorName || d.phoneNumber}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{d.phoneNumber} · C/O: {d.careOf || 'Direct'}</div>
                </div>
                <div style={{ fontWeight: 800, color: '#10b981' }}>{formatINR(d.totalPaid)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {matchedCareOfs.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Care Of Groups ({matchedCareOfs.length})</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {matchedCareOfs.map(co => (
              <button key={co.careOfName} onClick={() => onSelectCareOf(co)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{co.careOfName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{co.donorCount} donors</div>
                </div>
                <div style={{ fontWeight: 800, color: '#10b981' }}>{formatINR(co.totalCollected)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {matchedDonors.length === 0 && matchedCareOfs.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '3rem' }}>No results found for "{query}"</p>
      )}
    </div>
  );
}

// ── MAIN DASHBOARD ──────────────────────────────────────────────────────────
export const Dashboard: React.FC<DashboardProps> = ({
  transactionDataset,
  slabs,
  slabAssignments,
  onSlabsChange,
  onAssignmentsChange,
  onAddDonor,
  onUpdateTransactionRow,
  onUpdateMultipleTransactionRows,
  onDeleteTransactionRow,
}) => {
  const [drill, setDrill] = useState<DrillDown>({ view: 'home' });
  const [showAddDonor, setShowAddDonor] = useState(false);
  const [showSlabManager, setShowSlabManager] = useState(false);
  const [activeSlabFilter, setActiveSlabFilter] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Date Range Filter state
  const [dateRange, setDateRange] = useState<DateRangeFilter>({});
  const [datePreset, setDatePreset] = useState<'all' | 'this_month' | 'last_30' | 'this_year' | 'custom'>('all');

  const applyDatePreset = (preset: 'all' | 'this_month' | 'last_30' | 'this_year' | 'custom') => {
    setDatePreset(preset);
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    if (preset === 'all') {
      setDateRange({});
    } else if (preset === 'this_month') {
      const firstDay = `${yyyy}-${mm}-01`;
      setDateRange({ from: firstDay, to: todayStr });
    } else if (preset === 'last_30') {
      const past = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const pY = past.getFullYear();
      const pM = String(past.getMonth() + 1).padStart(2, '0');
      const pD = String(past.getDate()).padStart(2, '0');
      setDateRange({ from: `${pY}-${pM}-${pD}`, to: todayStr });
    } else if (preset === 'this_year') {
      setDateRange({ from: `${yyyy}-01-01`, to: todayStr });
    }
  };

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const reportData = useMemo(() => {
    const txRows = transactionDataset?.rows ?? [];
    return aggregateDonationData(txRows, [], slabAssignments, slabs, dateRange);
  }, [transactionDataset, slabAssignments, slabs, dateRange]);

  const { summary, donorsByPhone, careOfSummaries } = reportData;

  const existingCareOfs = useMemo(
    () => [...new Set(donorsByPhone.map(d => d.careOf).filter(c => c && c !== 'Direct'))],
    [donorsByPhone]
  );

  // Slab filter: donors in each slab
  const slabStats = useMemo(() => {
    return slabs.map(slab => {
      const assigned = slabAssignments.filter(a => a.slabId === slab.id);
      const donors = donorsByPhone.filter(d => d.slabId === slab.id);
      const totalCollected = donors.reduce((sum, d) => sum + d.totalPaid, 0);
      const totalTarget = assigned.reduce((sum, a) => sum + slab.amount * (a.units ?? 1), 0);
      return { slab, donorCount: donors.length, totalCollected, totalTarget, donors };
    }).filter(s => s.donorCount > 0);
  }, [slabs, slabAssignments, donorsByPhone]);

  // Apply slab filter
  const filteredDonorsByPhone = useMemo(() => {
    if (!activeSlabFilter) return donorsByPhone;
    return donorsByPhone.filter(d => d.slabId === activeSlabFilter);
  }, [donorsByPhone, activeSlabFilter]);

  const notStarted = filteredDonorsByPhone.filter(d => !d.statusInfo.isStarted);
  const expiring = filteredDonorsByPhone.filter(d => d.statusInfo.isExpiringSoon);
  const started = filteredDonorsByPhone.filter(d => d.statusInfo.isStarted && !d.statusInfo.isFullyPaid && !d.statusInfo.isExpiringSoon);
  const fullyPaid = filteredDonorsByPhone.filter(d => d.statusInfo.isFullyPaid);

  // Live suggestions: matching donors + careOf groups
  const suggestions = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q || q.length < 1) return { donors: [], careOfs: [] };

    const donors = donorsByPhone
      .filter(d =>
        d.donorName.toLowerCase().includes(q) ||
        d.phoneNumber.includes(q) ||
        d.rawPhone.includes(q)
      )
      .slice(0, 6);

    const careOfs = careOfSummaries
      .filter(co => co.careOfName.toLowerCase().includes(q))
      .slice(0, 3);

    return { donors, careOfs };
  }, [globalSearch, donorsByPhone, careOfSummaries]);

  const hasSuggestions = suggestions.donors.length > 0 || suggestions.careOfs.length > 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    if (globalSearch.trim()) {
      setDrill({ view: 'search_results', query: globalSearch.trim() });
    }
  };

  const goHome = () => { setDrill({ view: 'home' }); setGlobalSearch(''); };

  const handleSelectDonor = (d: DonorRecord) => setDrill({ view: 'donor_detail', donor: d });
  const handleSelectCareOf = (co: CareOfSummary) => setDrill({ view: 'careof_detail', co });

  // Update Handlers
  const handleUpdateDonorProfile = (donor: DonorRecord, updates: { name: string; phone: string; careOf: string; address?: string; remarks?: string; startDate?: string }) => {
    const rowIds = donor.transactions.map(t => t.id);
    const rowUpdates: Record<string, any> = {};
    if (updates.name !== undefined) {
      rowUpdates['Name'] = updates.name;
      rowUpdates['NAME'] = updates.name;
    }
    if (updates.phone !== undefined) {
      rowUpdates['Contact 1'] = updates.phone;
      rowUpdates['PHONE NUMBER'] = updates.phone;
      rowUpdates['Phone Number'] = updates.phone;
    }
    if (updates.careOf !== undefined) {
      rowUpdates['C/O'] = updates.careOf;
      rowUpdates['Care Of'] = updates.careOf;
      rowUpdates['CARE OF'] = updates.careOf;
    }
    if (updates.address !== undefined) {
      rowUpdates['ADDRESS'] = updates.address;
      rowUpdates['Address'] = updates.address;
    }
    if (updates.remarks !== undefined) {
      rowUpdates['Remarks'] = updates.remarks;
    }
    if (updates.startDate !== undefined) {
      rowUpdates['Date'] = updates.startDate;
      rowUpdates['DATE'] = updates.startDate;
    }
    if (onUpdateMultipleTransactionRows && rowIds.length > 0) {
      onUpdateMultipleTransactionRows(rowIds, rowUpdates);
    }
  };

  const handleUpdateTransaction = (txId: string, rowUpdates: Record<string, any>) => {
    if (onUpdateTransactionRow) {
      onUpdateTransactionRow(txId, rowUpdates);
    }
  };

  const handleRenameCareOfGroup = (co: CareOfSummary, newCareOfName: string) => {
    const allTxIds = co.donors.flatMap(d => d.transactions.map(t => t.id));
    const rowUpdates: Record<string, any> = {
      'C/O': newCareOfName,
      'Care Of': newCareOfName,
      'CARE OF': newCareOfName,
    };
    if (onUpdateMultipleTransactionRows && allTxIds.length > 0) {
      onUpdateMultipleTransactionRows(allTxIds, rowUpdates);
    }
  };

  // ── render drill-down screens ──
  if (drill.view === 'donor_detail') {
    return (
      <div style={{ padding: '1.25rem 1rem', maxWidth: 700, margin: '0 auto' }}>
        <DonorDetail
          donor={drill.donor}
          onBack={goHome}
          existingCareOfs={existingCareOfs}
          onUpdateDonor={handleUpdateDonorProfile}
          onUpdateTx={handleUpdateTransaction}
          onDeleteTx={onDeleteTransactionRow}
        />
      </div>
    );
  }

  if (drill.view === 'careof_detail') {
    return (
      <div style={{ padding: '1.25rem 1rem', maxWidth: 700, margin: '0 auto' }}>
        <CareOfDetail
          co={drill.co}
          onBack={goHome}
          onSelectDonor={handleSelectDonor}
          onRenameCareOf={handleRenameCareOfGroup}
        />
      </div>
    );
  }

  if (drill.view === 'status_list') {
    const listMap: Record<string, DonorRecord[]> = {
      started, not_started: notStarted, expiring, fully_paid: fullyPaid,
    };
    const labelMap: Record<string, string> = {
      started: 'Active Donors',
      not_started: 'Not Yet Started',
      expiring: 'Expiring This Month',
      fully_paid: 'Fully Paid',
    };
    return (
      <div style={{ padding: '1.25rem 1rem', maxWidth: 700, margin: '0 auto' }}>
        <StatusList
          donors={listMap[drill.status] || []}
          status={labelMap[drill.status] || drill.status}
          onBack={goHome}
          onSelectDonor={handleSelectDonor}
        />
      </div>
    );
  }

  if (drill.view === 'search_results') {
    return (
      <div style={{ padding: '1.25rem 1rem', maxWidth: 700, margin: '0 auto' }}>
        <SearchResults
          donors={donorsByPhone}
          careOfs={careOfSummaries}
          query={drill.query}
          onBack={goHome}
          onSelectDonor={handleSelectDonor}
          onSelectCareOf={handleSelectCareOf}
        />
      </div>
    );
  }

  // ── HOME SCREEN ──────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '1rem', maxWidth: 780, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

      {/* Search bar with live suggestions */}
      <div ref={searchRef} style={{ position: 'relative' }}>
        <form onSubmit={handleSearch}>
          <Search size={16} style={{ position: 'absolute', left: 14, top: 24, transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', zIndex: 1 }} />
          <input
            className="input-field"
            style={{ paddingLeft: 42, paddingRight: 110, fontSize: '1rem', height: 48, borderRadius: showSuggestions && hasSuggestions ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)', transition: 'border-radius 0.15s' }}
            placeholder="Search donor name, phone, C/O..."
            value={globalSearch}
            onChange={e => { setGlobalSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => globalSearch.trim() && setShowSuggestions(true)}
            autoComplete="off"
          />
          {globalSearch && (
            <button type="button" style={{ position: 'absolute', right: 110, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, zIndex: 1 }} onClick={() => { setGlobalSearch(''); setShowSuggestions(false); }}>
              <X size={14} color="var(--text-muted)" />
            </button>
          )}
          <button type="submit" className="btn btn-primary btn-sm" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}>
            Search
          </button>
        </form>

        {/* Suggestions dropdown */}
        {showSuggestions && hasSuggestions && (
          <div style={{
            position: 'absolute', top: 48, left: 0, right: 0,
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderTop: 'none',
            borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 100,
            overflow: 'hidden',
            maxHeight: 320,
            overflowY: 'auto',
          }}>
            {suggestions.donors.length > 0 && (
              <>
                <div style={{ padding: '6px 14px 4px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg-tertiary)' }}>
                  Donors
                </div>
                {suggestions.donors.map(d => (
                  <button
                    key={d.id}
                    type="button"
                    onMouseDown={() => { handleSelectDonor(d); setGlobalSearch(''); setShowSuggestions(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      width: '100%', padding: '0.6rem 1rem',
                      background: 'none', border: 'none', borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      {d.donorName.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.donorName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>{d.phoneNumber} · {d.careOf}</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#10b981', flexShrink: 0 }}>₹{d.totalPaid.toLocaleString('en-IN')}</div>
                  </button>
                ))}
              </>
            )}

            {suggestions.careOfs.length > 0 && (
              <>
                <div style={{ padding: '6px 14px 4px', fontSize: '0.68rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', background: 'var(--bg-tertiary)' }}>
                  C/O Groups
                </div>
                {suggestions.careOfs.map(co => (
                  <button
                    key={co.careOfName}
                    type="button"
                    onMouseDown={() => { handleSelectCareOf(co); setGlobalSearch(''); setShowSuggestions(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.75rem',
                      width: '100%', padding: '0.6rem 1rem',
                      background: 'none', border: 'none', borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Building2 size={14} color="var(--accent-primary)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{co.careOfName}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>{co.donorCount} donors</div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.8rem', color: '#10b981', flexShrink: 0 }}>₹{co.totalCollected.toLocaleString('en-IN')}</div>
                  </button>
                ))}
              </>
            )}

            {/* View all results */}
            <button
              type="button"
              onMouseDown={() => { setShowSuggestions(false); setDrill({ view: 'search_results', query: globalSearch.trim() }); }}
              style={{ width: '100%', padding: '0.6rem 1rem', background: 'var(--bg-tertiary)', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)', fontFamily: 'inherit', textAlign: 'center' }}
            >
              View all results for "{globalSearch}" →
            </button>
          </div>
        )}
      </div>

      {/* Date Range Filter Bar */}
      <div className="glass-panel" style={{ padding: '0.85rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            <Calendar size={16} color="var(--accent-primary)" />
            <span>Date Range Filter</span>
            {(dateRange.from || dateRange.to) && (
              <span style={{ fontSize: '0.72rem', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                Active Filter ({summary.totalTransactions} payments)
              </span>
            )}
          </div>

          {/* Preset Buttons */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_30', label: 'Last 30 Days' },
              { id: 'this_year', label: 'This Year' },
              { id: 'custom', label: 'Custom Range' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyDatePreset(p.id as any)}
                style={{
                  padding: '0.3rem 0.65rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-sm)',
                  border: datePreset === p.id ? '1px solid var(--accent-primary)' : '1px dashed var(--border-color)',
                  background: datePreset === p.id ? 'rgba(99,102,241,0.18)' : 'var(--bg-tertiary)',
                  color: datePreset === p.id ? 'var(--accent-primary)' : 'var(--text-primary)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date Pickers if custom selected or active */}
        {(datePreset === 'custom' || dateRange.from || dateRange.to) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>From:</span>
              <input
                type="date"
                className="input-field"
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', height: 34, width: 145 }}
                value={dateRange.from || ''}
                onChange={e => { setDatePreset('custom'); setDateRange(prev => ({ ...prev, from: e.target.value })); }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>To:</span>
              <input
                type="date"
                className="input-field"
                style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem', height: 34, width: 145 }}
                value={dateRange.to || ''}
                onChange={e => { setDatePreset('custom'); setDateRange(prev => ({ ...prev, to: e.target.value })); }}
              />
            </div>
            {(dateRange.from || dateRange.to) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => applyDatePreset('all')}
                style={{ fontSize: '0.75rem', color: '#ef4444', padding: '0.3rem 0.6rem' }}
              >
                <X size={12} style={{ marginRight: 4 }} /> Reset Date Filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Top summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid #10b981' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em' }}>Total Raised</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#10b981' }}>{formatINR(summary.totalCollected)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2, fontWeight: 500 }}>{summary.totalTransactions} verified payments</div>
        </div>
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid #6366f1' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em' }}>Committed Target</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--accent-primary)' }}>{formatINR(summary.totalCommitted)}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2, fontWeight: 500 }}>Balance: {formatINR(summary.totalBalance)}</div>
        </div>
      </div>

      {/* Slab Filter Chips */}
      {slabStats.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Tag size={13} style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }} />
              Sponsorship Slabs
            </p>
            {activeSlabFilter && (
              <button
                onClick={() => setActiveSlabFilter(null)}
                style={{ fontSize: '0.72rem', color: 'var(--accent-primary)', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Clear filter ×
              </button>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {slabStats.map(({ slab, donorCount, totalCollected, totalTarget }) => {
              const pct = totalTarget > 0 ? Math.min(100, Math.round((totalCollected / totalTarget) * 100)) : 0;
              const isActive = activeSlabFilter === slab.id;
              return (
                <button
                  key={slab.id}
                  onClick={() => setActiveSlabFilter(isActive ? null : slab.id)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 4,
                    padding: '0.6rem 0.875rem',
                    borderRadius: 'var(--radius-md)',
                    border: `1.5px solid ${isActive ? slab.color : slab.color + '50'}`,
                    background: isActive ? `${slab.color}25` : 'var(--bg-secondary)',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    transition: 'all 0.2s',
                    minWidth: 120,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: slab.color }}>
                      {slab.category} {slab.label}
                    </span>
                    <span style={{ fontSize: '0.68rem', background: `${slab.color}20`, color: slab.color, padding: '1px 5px', borderRadius: 4, fontWeight: 700 }}>
                      {donorCount}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    {formatINR(totalCollected)}
                  </div>
                  {totalTarget > 0 && (
                    <div style={{ height: 3, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden', marginTop: 2 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: slab.color, borderRadius: 2 }} />
                    </div>
                  )}
                </button>
              );
            })}
            {/* Unassigned badge */}
            {(() => {
              const unassignedCount = donorsByPhone.filter(d => !d.isSlabAssigned).length;
              return unassignedCount > 0 ? (
                <button
                  onClick={() => setShowSlabManager(true)}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 4,
                    padding: '0.6rem 0.875rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1.5px dashed #f59e0b',
                    background: 'rgba(245,158,11,0.08)',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    minWidth: 120,
                  }}
                >
                  <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f59e0b' }}>⚠ Unassigned</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-primary)', fontWeight: 600 }}>{unassignedCount} donors</span>
                  <span style={{ fontSize: '0.68rem', color: '#f59e0b' }}>Tap to assign →</span>
                </button>
              ) : null;
            })()}
          </div>
        </div>
      )}
      <div>
        <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Donation Status
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem' }}>
          {[
            { label: 'Active Donors', count: started.length, color: '#10b981', bg: 'rgba(16,185,129,0.12)', status: 'started', icon: <CheckCircle2 size={18} color="#10b981" /> },
            { label: 'Not Started', count: notStarted.length, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', status: 'not_started', icon: <Clock size={18} color="#f59e0b" /> },
            { label: 'Expiring Soon', count: expiring.length, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', status: 'expiring', icon: <AlertCircle size={18} color="#ef4444" /> },
            { label: 'Fully Paid', count: fullyPaid.length, color: '#6366f1', bg: 'rgba(99,102,241,0.12)', status: 'fully_paid', icon: <TrendingUp size={18} color="#6366f1" /> },
          ].map(item => (
            <button
              key={item.status}
              onClick={() => setDrill({ view: 'status_list', status: item.status as any })}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.875rem 1rem', background: item.bg, border: `1px solid ${item.color}40`, borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.2s' }}
            >
              {item.icon}
              <div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.count}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 700, marginTop: 4 }}>{item.label}</div>
              </div>
              <ChevronRight size={16} color="var(--text-secondary)" style={{ marginLeft: 'auto' }} />
            </button>
          ))}
        </div>
      </div>

      {/* Care Of groups */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top Care Of (C/O) Groups
          </p>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{careOfSummaries.length} groups</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {careOfSummaries.slice(0, 6).map(co => (
            <button
              key={co.careOfName}
              onClick={() => handleSelectCareOf(co)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.2s' }}
            >
              <Building2 size={18} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.careOfName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div style={{ flex: 1, height: 5, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${co.progressPercent}%`, background: 'var(--accent-gradient)', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 700, whiteSpace: 'nowrap' }}>{co.progressPercent}%</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#10b981' }}>{formatINR(co.totalCollected)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{co.donorCount} donors</div>
              </div>
              <ChevronRight size={16} color="var(--text-secondary)" />
            </button>
          ))}
          {careOfSummaries.length > 6 && (
            <button onClick={() => setDrill({ view: 'status_list', status: 'started' })} style={{ textAlign: 'center', padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              View all {careOfSummaries.length} groups →
            </button>
          )}
        </div>
      </div>

      {/* Recent transactions */}
      <div>
        <p style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Recent Payments
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {donorsByPhone
            .filter(d => d.transactions.length > 0)
            .flatMap(d => d.transactions.map(t => ({ ...t, donorName: d.donorName, donorId: d.id, donor: d })))
            .sort((a, b) => (b.dateObj?.getTime() ?? 0) - (a.dateObj?.getTime() ?? 0))
            .slice(0, 5)
            .map((t, i) => (
              <button key={i}
                onClick={() => handleSelectDonor(t.donor)}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{t.donorName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{t.date} · {t.mode}</div>
                </div>
                <div style={{ fontWeight: 800, color: '#10b981', fontSize: '0.95rem' }}>{formatINR(t.amount)}</div>
              </button>
            ))}
        </div>
      </div>

      {/* Floating buttons */}
      <div style={{ position: 'fixed', bottom: 24, right: 20, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 100 }}>
        {/* Manage Slabs */}
        <button
          className="btn btn-secondary"
          onClick={() => setShowSlabManager(true)}
          style={{ width: 48, height: 48, borderRadius: '50%', padding: 0, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}
          title="Manage Slabs"
        >
          <Tag size={18} />
          {donorsByPhone.filter(d => !d.isSlabAssigned).length > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -4, background: '#f59e0b', color: '#000', borderRadius: '50%', width: 16, height: 16, fontSize: '0.6rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {Math.min(99, donorsByPhone.filter(d => !d.isSlabAssigned).length)}
            </span>
          )}
        </button>
        {/* Add Donor */}
        <button
          className="btn btn-primary"
          onClick={() => setShowAddDonor(true)}
          style={{ width: 56, height: 56, borderRadius: '50%', padding: 0, fontSize: '1.5rem', boxShadow: '0 8px 30px rgba(99,102,241,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title="Add New Donor"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Add Donor Sheet */}
      {showAddDonor && (
        <AddDonorSheet
          onClose={() => setShowAddDonor(false)}
          onSubmit={onAddDonor}
          existingCareOfs={existingCareOfs}
          existingDonors={donorsByPhone.map(d => ({ phone: d.phoneNumber, name: d.donorName, careOf: d.careOf }))}
        />
      )}

      {/* Slab Manager Modal */}
      {showSlabManager && (
        <SlabManager
          slabs={slabs}
          slabAssignments={slabAssignments}
          donors={donorsByPhone}
          onClose={() => setShowSlabManager(false)}
          onSlabsChange={onSlabsChange}
          onAssignmentsChange={onAssignmentsChange}
        />
      )}
    </div>
  );
};
