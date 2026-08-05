import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, Tag, Check, Pencil } from 'lucide-react';
import {
  type DonationSlab,
  type SlabAssignment,
  addSlab,
  updateSlab,
  deleteSlab,
  assignDonorToSlab,
  removeDonorAssignment,
  suggestSlab,
  getCategoryColor,
} from '../utils/slabManager';
import type { DonorRecord } from '../utils/donationAggregator';

interface SlabManagerProps {
  slabs: DonationSlab[];
  slabAssignments: SlabAssignment[];
  donors: DonorRecord[];
  onClose: () => void;
  onSlabsChange: (slabs: DonationSlab[]) => void;
  onAssignmentsChange: (assignments: SlabAssignment[]) => void;
}

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa',
  '#10b981', '#34d399', '#6ee7b7',
  '#f59e0b', '#ef4444', '#3b82f6', '#ec4899',
];

function formatINR(n: number) {
  return '₹' + n.toLocaleString('en-IN');
}

export const SlabManager: React.FC<SlabManagerProps> = ({
  slabs,
  slabAssignments,
  donors,
  onClose,
  onSlabsChange,
  onAssignmentsChange,
}) => {
  const [tab, setTab] = useState<'slabs' | 'assign'>('slabs');

  // ── New Slab Form ──
  const [newCategory, setNewCategory] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newUnit, setNewUnit] = useState('student');
  const [newColor, setNewColor] = useState(COLORS[6]);
  const [showAddForm, setShowAddForm] = useState(false);

  // ── Edit Slab State ──
  const [editingSlab, setEditingSlab] = useState<DonationSlab | null>(null);

  // ── Assign Tab State ──
  const [searchQ, setSearchQ] = useState('');
  const [assigningDonor, setAssigningDonor] = useState<DonorRecord | null>(null);
  const [selectedSlabId, setSelectedSlabId] = useState('');
  const [selectedUnits, setSelectedUnits] = useState(1);
  const [filterAssigned, setFilterAssigned] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Group slabs by category
  const slabsByCategory = useMemo(() => {
    const map = new Map<string, DonationSlab[]>();
    slabs.forEach(s => {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    });
    return map;
  }, [slabs]);

  // Filter donors for assignment tab
  const filteredDonors = useMemo(() => {
    const q = searchQ.toLowerCase();
    return donors
      .filter(d => {
        const matchQ = !q || d.donorName.toLowerCase().includes(q) || d.phoneNumber.includes(q);
        const assigned = !!slabAssignments.find(a => a.phoneNumber === d.rawPhone);
        if (filterAssigned === 'assigned') return matchQ && assigned;
        if (filterAssigned === 'unassigned') return matchQ && !assigned;
        return matchQ;
      })
      .sort((a, b) => {
        // Unassigned first
        const aAssigned = !!slabAssignments.find(x => x.phoneNumber === a.rawPhone);
        const bAssigned = !!slabAssignments.find(x => x.phoneNumber === b.rawPhone);
        if (aAssigned !== bAssigned) return aAssigned ? 1 : -1;
        return b.totalPaid - a.totalPaid;
      });
  }, [donors, searchQ, slabAssignments, filterAssigned]);

  const handleAddSlab = () => {
    if (!newCategory.trim() || !newLabel.trim() || !newAmount) return;
    const updated = addSlab(slabs, {
      category: newCategory.trim(),
      label: newLabel.trim(),
      amount: Number(newAmount),
      unit: newUnit.trim() || 'student',
      color: newColor,
    });
    onSlabsChange(updated);
    setNewCategory(''); setNewLabel(''); setNewAmount(''); setNewUnit('student');
    setShowAddForm(false);
  };

  const handleUpdateSlab = (updatedSlab: DonationSlab) => {
    const updated = updateSlab(slabs, updatedSlab);
    onSlabsChange(updated);
    setEditingSlab(null);
  };

  const handleDeleteSlab = (slabId: string) => {
    const updated = deleteSlab(slabs, slabId);
    onSlabsChange(updated);
  };

  const openAssign = (donor: DonorRecord) => {
    setAssigningDonor(donor);
    const existing = slabAssignments.find(a => a.phoneNumber === donor.rawPhone);
    if (existing) {
      setSelectedSlabId(existing.slabId);
      setSelectedUnits(existing.units);
    } else {
      // Auto-suggest
      const suggestion = suggestSlab(donor.totalPaid, slabs);
      setSelectedSlabId(suggestion?.slabId || slabs[0]?.id || '');
      setSelectedUnits(suggestion?.units || 1);
    }
  };

  const handleSaveAssignment = () => {
    if (!assigningDonor || !selectedSlabId) return;
    const updated = assignDonorToSlab(
      slabAssignments,
      assigningDonor.rawPhone,
      selectedSlabId,
      selectedUnits
    );
    onAssignmentsChange(updated);
    setAssigningDonor(null);
  };

  const handleRemoveAssignment = (phoneNumber: string) => {
    const updated = removeDonorAssignment(slabAssignments, phoneNumber);
    onAssignmentsChange(updated);
  };

  const selectedSlab = slabs.find(s => s.id === selectedSlabId);
  const computedTarget = selectedSlab ? selectedSlab.amount * selectedUnits : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-container"
        style={{ maxWidth: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={18} color="#fff" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', margin: 0 }}>Sponsorship Slabs</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>Manage slabs & assign donors</p>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Tab Bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', padding: '0 1.5rem' }}>
          {(['slabs', 'assign'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '0.6rem 1rem', background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid var(--accent-primary)' : '2px solid transparent',
                color: tab === t ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', fontFamily: 'inherit',
                textTransform: 'capitalize',
              }}
            >
              {t === 'slabs' ? 'Manage Slabs' : `Assign Donors (${slabAssignments.length}/${donors.length})`}
            </button>
          ))}
        </div>

        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>

          {/* ── SLABS TAB ─────────────────────────────── */}
          {tab === 'slabs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {Array.from(slabsByCategory.entries()).map(([category, catSlabs]) => (
                <div key={category}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: getCategoryColor(category) }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {category}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      ({catSlabs.length} slabs)
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {catSlabs.map(slab => {
                      const donorCount = slabAssignments.filter(a => a.slabId === slab.id).length;
                      return (
                        <div
                          key={slab.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.75rem 1rem',
                            background: 'var(--bg-secondary)',
                            border: `1px solid ${slab.color}40`,
                            borderLeft: `3px solid ${slab.color}`,
                            borderRadius: 'var(--radius-md)',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                {slab.label}
                              </span>
                              {slab.isDefault && (
                                <span style={{ fontSize: '0.65rem', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                  DEFAULT
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                              {formatINR(slab.amount)} per {slab.unit} · {donorCount} donor{donorCount !== 1 ? 's' : ''} assigned
                            </div>
                          </div>
                          <div style={{ fontWeight: 800, color: slab.color, fontSize: '1rem' }}>
                            {formatINR(slab.amount)}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                              className="btn btn-ghost btn-icon"
                              title="Edit slab"
                              onClick={() => setEditingSlab(slab)}
                              style={{ padding: 4 }}
                            >
                              <Pencil size={14} color="var(--text-muted)" />
                            </button>
                            <button
                              className="btn btn-ghost btn-icon"
                              style={{ color: '#ef4444', padding: 4 }}
                              title="Delete slab"
                              onClick={() => handleDeleteSlab(slab.id)}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Add New Slab */}
              {!showAddForm ? (
                <button
                  className="btn btn-secondary"
                  style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => setShowAddForm(true)}
                >
                  <Plus size={14} /> Add Custom Slab
                </button>
              ) : (
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', margin: 0 }}>New Slab</p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Category</label>
                      <input className="input-field" placeholder="e.g. Education" value={newCategory} onChange={e => setNewCategory(e.target.value)} list="cat-suggest" />
                      <datalist id="cat-suggest">
                        {Array.from(new Set(slabs.map(s => s.category))).map(c => <option key={c} value={c} />)}
                      </datalist>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Label</label>
                      <input className="input-field" placeholder="e.g. Full, Half, Custom" value={newLabel} onChange={e => setNewLabel(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Amount (₹)</label>
                      <input className="input-field" type="number" placeholder="e.g. 50000" value={newAmount} onChange={e => setNewAmount(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Unit</label>
                      <input className="input-field" placeholder="student / child / month" value={newUnit} onChange={e => setNewUnit(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Color</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColor(c)}
                          style={{ width: 24, height: 24, borderRadius: '50%', background: c, border: newColor === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', outline: newColor === c ? `2px solid ${c}` : 'none' }}
                        />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={handleAddSlab} disabled={!newCategory || !newLabel || !newAmount}>
                      <Check size={14} /> Save Slab
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── ASSIGN TAB ───────────────────────────── */}
          {tab === 'assign' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {/* Assign Modal Overlay */}
              {assigningDonor && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '1.5rem', width: 400, maxWidth: '95vw', boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <div>
                        <p style={{ fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{assigningDonor.donorName || assigningDonor.phoneNumber}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>Total paid: {formatINR(assigningDonor.totalPaid)}</p>
                      </div>
                      <button className="btn btn-ghost btn-icon" onClick={() => setAssigningDonor(null)}><X size={16} /></button>
                    </div>

                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Select Slab</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, maxHeight: 220, overflowY: 'auto' }}>
                      {slabs.map(slab => (
                        <button
                          key={slab.id}
                          onClick={() => setSelectedSlabId(slab.id)}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.6rem 0.875rem',
                            borderRadius: 'var(--radius-md)',
                            border: `1.5px solid ${selectedSlabId === slab.id ? slab.color : 'var(--border-color)'}`,
                            background: selectedSlabId === slab.id ? `${slab.color}20` : 'var(--bg-secondary)',
                            cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                          }}
                        >
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                            {slab.category} {slab.label}
                          </span>
                          <span style={{ fontWeight: 800, color: slab.color }}>{formatINR(slab.amount)}</span>
                        </button>
                      ))}
                    </div>

                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
                      Number of Students / Units
                    </label>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                      {[1,2,3,4,5,6].map(n => (
                        <button
                          key={n}
                          onClick={() => setSelectedUnits(n)}
                          style={{
                            width: 36, height: 36, borderRadius: 8,
                            border: `1.5px solid ${selectedUnits === n ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                            background: selectedUnits === n ? 'rgba(99,102,241,0.2)' : 'var(--bg-secondary)',
                            color: selectedUnits === n ? 'var(--accent-primary)' : 'var(--text-primary)',
                            fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                          }}
                        >
                          {n}
                        </button>
                      ))}
                      <input
                        className="input-field"
                        type="number"
                        min={1}
                        style={{ width: 64, textAlign: 'center' }}
                        value={selectedUnits}
                        onChange={e => setSelectedUnits(Math.max(1, Number(e.target.value)))}
                      />
                    </div>

                    {selectedSlab && (
                      <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem', marginBottom: 12, fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Slab</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{selectedSlab.category} {selectedSlab.label}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Target ({selectedUnits} × {formatINR(selectedSlab.amount)})</span>
                          <span style={{ fontWeight: 800, color: '#10b981' }}>{formatINR(computedTarget)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Paid so far</span>
                          <span style={{ fontWeight: 700, color: assigningDonor.totalPaid >= computedTarget ? '#10b981' : '#f59e0b' }}>{formatINR(assigningDonor.totalPaid)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                          <span style={{ color: 'var(--text-muted)' }}>Remaining</span>
                          <span style={{ fontWeight: 700, color: '#ef4444' }}>{formatINR(Math.max(0, computedTarget - assigningDonor.totalPaid))}</span>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveAssignment} disabled={!selectedSlabId}>
                        <Check size={14} /> Assign Slab
                      </button>
                      <button className="btn btn-ghost" onClick={() => setAssigningDonor(null)}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Search + Filter */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input-field"
                  placeholder="Search donor name or phone..."
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                  style={{ flex: 1 }}
                />
                <select
                  className="input-field select-field"
                  style={{ width: 140 }}
                  value={filterAssigned}
                  onChange={e => setFilterAssigned(e.target.value as any)}
                >
                  <option value="all">All Donors</option>
                  <option value="unassigned">Unassigned</option>
                  <option value="assigned">Assigned</option>
                </select>
              </div>

              {/* Donor list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {filteredDonors.map(donor => {
                  const assignment = slabAssignments.find(a => a.phoneNumber === donor.rawPhone);
                  const assignedSlab = assignment ? slabs.find(s => s.id === assignment.slabId) : null;
                  const target = assignedSlab ? assignedSlab.amount * (assignment?.units ?? 1) : 0;
                  const pct = target > 0 ? Math.min(100, Math.round((donor.totalPaid / target) * 100)) : 0;

                  return (
                    <div
                      key={donor.id}
                      style={{
                        padding: '0.75rem 1rem',
                        background: 'var(--bg-secondary)',
                        border: `1px solid ${assignment ? assignedSlab?.color + '40' : 'var(--border-color)'}`,
                        borderLeft: `3px solid ${assignedSlab?.color || 'var(--border-color)'}`,
                        borderRadius: 'var(--radius-md)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {donor.donorName || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No name</span>}
                          </div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {donor.phoneNumber} · Paid: {formatINR(donor.totalPaid)}
                          </div>
                          {assignment && assignedSlab && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                              <span style={{ fontSize: '0.7rem', background: `${assignedSlab.color}25`, color: assignedSlab.color, padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                {assignedSlab.category} {assignedSlab.label}
                                {(assignment.units ?? 1) > 1 ? ` ×${assignment.units}` : ''}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {pct}% of {formatINR(target)}
                              </span>
                            </div>
                          )}
                          {!assignment && (
                            <span style={{ fontSize: '0.7rem', color: '#f59e0b', fontWeight: 600, marginTop: 4, display: 'block' }}>
                              ⚠ Not assigned to a slab
                            </span>
                          )}
                        </div>

                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <button
                            className="btn btn-sm btn-secondary"
                            onClick={() => openAssign(donor)}
                          >
                            {assignment ? 'Change' : 'Assign'}
                          </button>
                          {assignment && (
                            <button
                              className="btn btn-sm btn-ghost"
                              style={{ color: '#ef4444' }}
                              onClick={() => handleRemoveAssignment(donor.rawPhone)}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress bar if assigned */}
                      {assignment && target > 0 && (
                        <div style={{ marginTop: 8, height: 4, background: 'var(--bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: assignedSlab?.color || 'var(--accent-primary)', borderRadius: 2, transition: 'width 0.4s ease' }} />
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredDonors.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem', fontSize: '0.875rem' }}>
                    No donors found.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Edit Slab Modal */}
        {editingSlab && (
          <div className="modal-overlay" onClick={() => setEditingSlab(null)}>
            <div className="modal-container" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Pencil size={18} color="var(--accent-primary)" />
                  <h3 style={{ fontSize: '1rem', margin: 0 }}>Edit Sponsorship Slab</h3>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={() => setEditingSlab(null)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                    Category
                  </label>
                  <input
                    className="input-field"
                    value={editingSlab.category}
                    onChange={e => setEditingSlab({ ...editingSlab, category: e.target.value })}
                    placeholder="e.g. Education, Food"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                      Label
                    </label>
                    <input
                      className="input-field"
                      value={editingSlab.label}
                      onChange={e => setEditingSlab({ ...editingSlab, label: e.target.value })}
                      placeholder="e.g. Full, Half, Quarter"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                      Target Amount (₹)
                    </label>
                    <input
                      className="input-field"
                      type="number"
                      value={editingSlab.amount}
                      onChange={e => setEditingSlab({ ...editingSlab, amount: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                      Unit Name
                    </label>
                    <input
                      className="input-field"
                      value={editingSlab.unit}
                      onChange={e => setEditingSlab({ ...editingSlab, unit: e.target.value })}
                      placeholder="student"
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
                      Color Theme
                    </label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
                      {COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditingSlab({ ...editingSlab, color: c })}
                          style={{
                            width: 22, height: 22, borderRadius: '50%', background: c,
                            border: editingSlab.color === c ? '2px solid #fff' : 'none',
                            cursor: 'pointer',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
                <button
                  className="btn btn-ghost"
                  style={{ color: '#ef4444' }}
                  onClick={() => { handleDeleteSlab(editingSlab.id); setEditingSlab(null); }}
                >
                  <Trash2 size={14} style={{ marginRight: 4 }} /> Delete Slab
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" onClick={() => setEditingSlab(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={() => handleUpdateSlab(editingSlab)}>Save Slab Changes</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
