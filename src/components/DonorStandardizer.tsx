import React, { useState, useMemo } from 'react';
import {
  GitMerge,
  Link,
  Unlink,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type {
  DonorAliasMap,
  PotentialDuplicateGroup,
} from '../utils/donorReconciliation';
import {
  findPotentialDuplicates,
  mergeDonorPhones,
  unlinkDonorPhone,
} from '../utils/donorReconciliation';
import type { DonorRecord } from '../utils/donationAggregator';

interface DonorStandardizerProps {
  donorRecords: DonorRecord[];
  aliasMap: DonorAliasMap;
  onAliasMapChange: (newMap: DonorAliasMap) => void;
}

export const DonorStandardizer: React.FC<DonorStandardizerProps> = ({
  donorRecords,
  aliasMap,
  onAliasMapChange,
}) => {
  // Manual Merge Form State
  const [primaryPhone, setPrimaryPhone] = useState('');
  const [secondaryPhone, setSecondaryPhone] = useState('');
  const [preferredName, setPreferredName] = useState('');

  // Search Filter for Linked Phone List
  const [searchFilter, setSearchFilter] = useState('');

  // Auto-scanned potential duplicate groups
  const duplicates: PotentialDuplicateGroup[] = useMemo(() => {
    return findPotentialDuplicates(donorRecords, aliasMap);
  }, [donorRecords, aliasMap]);

  const handleManualMerge = (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryPhone.trim() || !secondaryPhone.trim()) return;

    const updated = mergeDonorPhones(
      primaryPhone,
      secondaryPhone,
      aliasMap,
      preferredName.trim() || undefined
    );
    onAliasMapChange(updated);

    // Reset form
    setSecondaryPhone('');
    setPreferredName('');
  };

  const handleAcceptSuggestedMerge = (group: PotentialDuplicateGroup) => {
    const updated = mergeDonorPhones(
      group.primaryCandidatePhone,
      group.secondaryPhone,
      aliasMap,
      group.primaryName
    );
    onAliasMapChange(updated);
  };

  const handleUnlink = (secPhone: string) => {
    const updated = unlinkDonorPhone(secPhone, aliasMap);
    onAliasMapChange(updated);
  };

  // Filter linked phone list
  const linkedEntries = useMemo(() => {
    return Object.entries(aliasMap.phoneLinks).filter(([sec, prim]) => {
      const q = searchFilter.toLowerCase();
      return sec.includes(q) || prim.includes(q);
    });
  }, [aliasMap.phoneLinks, searchFilter]);

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <GitMerge size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800 }}>
              Donor Data Standardizer & Alias Reconciler
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Standardize historical payments from 2024 onwards. Link multiple mobile numbers or alternate name spellings to a single canonical Donor Profile.
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left Column: Manual Link / Merge Form */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.05rem' }}>
            <Link size={18} className="text-indigo-400" />
            <span>Link Alternate Phone Number</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            When a donor pays using a secondary mobile number (e.g. office/spouse number), link it here to automatically combine all transactions under their primary profile.
          </p>

          <form onSubmit={handleManualMerge} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Primary Canonical Mobile Number *
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 9895012345"
                value={primaryPhone}
                onChange={e => setPrimaryPhone(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Secondary / Alternate Mobile Number to Link *
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. 9447098765"
                value={secondaryPhone}
                onChange={e => setSecondaryPhone(e.target.value)}
                required
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                Standardized Primary Donor Name (Optional)
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Abdurahiman Haji"
                value={preferredName}
                onChange={e => setPreferredName(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
              <GitMerge size={16} /> Link Numbers & Merge Records
            </button>
          </form>
        </div>

        {/* Right Column: Suggested Duplicates Scanner */}
        <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '1.05rem' }}>
              <Sparkles size={18} className="text-amber-400" />
              <span>Smart Duplicate Suggestions ({duplicates.length})</span>
            </div>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Automatically detected donors sharing exact normalized names across different phone numbers.
          </p>

          {duplicates.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 0.5rem auto', color: 'var(--success)' }} />
              No obvious unlinked duplicate candidates found!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
              {duplicates.map((dup) => (
                <div
                  key={dup.id}
                  style={{
                    padding: '0.85rem',
                    background: 'var(--bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                      Matching Name
                    </span>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleAcceptSuggestedMerge(dup)}
                    >
                      <GitMerge size={14} /> Merge Profiles
                    </button>
                  </div>
                  <div style={{ fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: 700 }}>{dup.primaryName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', marginTop: '2px' }}>
                      <span>Phone 1: {dup.primaryCandidatePhone}</span>
                      <span>Phone 2: {dup.secondaryPhone}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Bottom Section: Active Linked Numbers Table */}
      <div className="glass-panel" style={{ padding: '1.5rem', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              Active Phone Number & Profile Links ({linkedEntries.length})
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              All secondary phone numbers currently mapped to canonical donor profiles.
            </p>
          </div>

          <div style={{ minWidth: '220px' }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search linked numbers..."
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
            />
          </div>
        </div>

        {linkedEntries.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No secondary phone links registered yet. Use the form above to link alternate numbers.
          </div>
        ) : (
          <div className="table-container" style={{ maxHeight: '300px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Secondary / Alternate Phone</th>
                  <th>Redirects To Canonical Phone</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {linkedEntries.map(([secPhone, primPhone]) => (
                  <tr key={secPhone}>
                    <td style={{ fontWeight: 600 }}>{secPhone}</td>
                    <td style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{primPhone}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => handleUnlink(secPhone)}
                        title="Unlink Phone Number"
                      >
                        <Unlink size={14} /> Unlink
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
