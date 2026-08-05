import React, { useState, useMemo } from 'react';
import {
  DollarSign,
  Calendar,
  Search,
  Download,
  ChevronDown,
  ChevronRight,
  PhoneCall,
  UserCheck,
  Building2,
  Award,
  CalendarRange,
  ArrowUpDown,
  Sparkles,
} from 'lucide-react';
import type { Dataset, RowData } from '../types/data';
import { aggregateDonationData } from '../utils/donationAggregator';
import { exportToExcel } from '../utils/csvParser';

import { type DonationSlab, type SlabAssignment } from '../utils/slabManager';

interface SponsorshipReportProps {
  transactionDataset: Dataset;
  masterDataset?: Dataset;
  allDatasets?: Dataset[];
  slabs?: DonationSlab[];
  slabAssignments?: SlabAssignment[];
}

export const SponsorshipReport: React.FC<SponsorshipReportProps> = ({
  transactionDataset,
  masterDataset,
  slabs,
  slabAssignments,
}) => {
  // Active sub-tab mode: 'donors' | 'careof' | 'categories'
  const [activeTab, setActiveTab] = useState<'donors' | 'careof' | 'categories'>('donors');

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'started' | 'not_started' | 'fully_paid' | 'expiring'>('all');
  const [careOfFilter, setCareOfFilter] = useState<string>('all');
  const [expandedDonorId, setExpandedDonorId] = useState<string | null>(null);
  const [expandedCareOfName, setExpandedCareOfName] = useState<string | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<'donorName' | 'totalPaid' | 'balanceRemaining' | 'startDate' | 'endDate'>('totalPaid');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Aggregate Data
  const reportData = useMemo(() => {
    const txRows = transactionDataset ? transactionDataset.rows : [];
    return aggregateDonationData(txRows, [], slabAssignments || [], slabs || []);
  }, [transactionDataset, slabAssignments, slabs]);

  const { summary, donorsByPhone, careOfSummaries } = reportData;

  // Filtered Donors List
  const filteredDonors = useMemo(() => {
    let result = [...donorsByPhone];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(d =>
        d.donorName.toLowerCase().includes(q) ||
        d.phoneNumber.toLowerCase().includes(q) ||
        d.careOf.toLowerCase().includes(q) ||
        d.sponsorshipCategory.toLowerCase().includes(q) ||
        d.transactions.some(t => t.voucherNo.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (statusFilter === 'started') {
      result = result.filter(d => d.statusInfo.isStarted);
    } else if (statusFilter === 'not_started') {
      result = result.filter(d => !d.statusInfo.isStarted);
    } else if (statusFilter === 'fully_paid') {
      result = result.filter(d => d.statusInfo.isFullyPaid);
    } else if (statusFilter === 'expiring') {
      result = result.filter(d => d.statusInfo.isExpiringSoon);
    }

    // Care Of filter
    if (careOfFilter !== 'all') {
      result = result.filter(d => d.careOf.toUpperCase() === careOfFilter.toUpperCase());
    }

    // Sorting
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'startDate') {
        valA = a.startDate ? a.startDate.getTime() : 0;
        valB = b.startDate ? b.startDate.getTime() : 0;
      } else if (sortField === 'endDate') {
        valA = a.endDate ? a.endDate.getTime() : 0;
        valB = b.endDate ? b.endDate.getTime() : 0;
      }

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === 'string') {
        return sortDirection === 'asc'
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [donorsByPhone, searchQuery, statusFilter, careOfFilter, sortField, sortDirection]);

  // Toggle sort
  const handleToggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Export handlers
  const handleExportExcelReport = () => {
    const exportRows: RowData[] = filteredDonors.map(d => ({
      _id: d.id,
      'Donor Name': d.donorName,
      'Phone Number': d.phoneNumber,
      'Care Of (C/O)': d.careOf,
      'Sponsorship Category': d.sponsorshipCategory,
      'Status': d.statusInfo.label,
      'Starting Date': d.startDateFormatted,
      '1-Year Ending Date': d.endDateFormatted,
      'Committed Target (₹)': d.totalCommitted,
      'Total Paid (₹)': d.totalPaid,
      'Balance Remaining (₹)': d.balanceRemaining,
      'Transactions Count': d.transactionCount,
      'Remarks': d.remarks,
    }));

    exportToExcel('Yatheem_Sponsorship_Report', [
      { id: 'Donor Name', label: 'Donor Name', type: 'text', visible: true, order: 1 },
      { id: 'Phone Number', label: 'Phone Number', type: 'text', visible: true, order: 2 },
      { id: 'Care Of (C/O)', label: 'Care Of (C/O)', type: 'text', visible: true, order: 3 },
      { id: 'Sponsorship Category', label: 'Sponsorship Category', type: 'text', visible: true, order: 4 },
      { id: 'Status', label: 'Status', type: 'status', visible: true, order: 5 },
      { id: 'Starting Date', label: 'Starting Date', type: 'date', visible: true, order: 6 },
      { id: '1-Year Ending Date', label: '1-Year Ending Date', type: 'date', visible: true, order: 7 },
      { id: 'Committed Target (₹)', label: 'Committed Target (₹)', type: 'currency', visible: true, order: 8 },
      { id: 'Total Paid (₹)', label: 'Total Paid (₹)', type: 'currency', visible: true, order: 9 },
      { id: 'Balance Remaining (₹)', label: 'Balance Remaining (₹)', type: 'currency', visible: true, order: 10 },
      { id: 'Transactions Count', label: 'Transactions Count', type: 'number', visible: true, order: 11 },
      { id: 'Remarks', label: 'Remarks', type: 'text', visible: true, order: 12 },
    ], exportRows);
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '1.5rem 2rem',
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.15) 0%, rgba(147, 51, 234, 0.1) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '16px',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(99, 102, 241, 0.4)',
            }}
          >
            <Sparkles color="#ffffff" size={28} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              Yatheem Student Donation & Sponsorship Report
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Multi-Worksheet Analysis • Phone Number Aggregations • Care Of Grouping • 1-Year Date Tracking
            </p>
          </div>
        </div>

        <button className="btn btn-primary" onClick={handleExportExcelReport}>
          <Download size={16} /> Export Full Report (.xlsx)
        </button>
      </div>

      {/* Summary Statistics Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        
        {/* Total Collected */}
        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Total Money Raised
            </span>
            <DollarSign className="text-emerald-400" size={20} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--emerald-400)' }}>
            ₹{summary.totalCollected.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            From {summary.totalTransactions} verified payments
          </div>
        </div>

        {/* Total Target / Committed */}
        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Total Target Committed
            </span>
            <Award className="text-indigo-400" size={20} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--indigo-400)' }}>
            ₹{summary.totalCommitted.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Remaining balance: ₹{summary.totalBalance.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Total Donors & Started Count */}
        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Donation Started Status
            </span>
            <UserCheck className="text-amber-400" size={20} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            {summary.startedDonorsCount} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 500 }}>/ {summary.totalDonors} Donors</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            {summary.startedDonorsCount} Started • {summary.notStartedCount} Pending First Payment
          </div>
        </div>

        {/* Unique Care Of Referral Groupings */}
        <div className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Care Of (C/O) Groups
            </span>
            <Building2 className="text-purple-400" size={20} />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--purple-400)' }}>
            {summary.uniqueCareOfCount} Referrers
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Managing {summary.totalDonors} student sponsorships
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          <button
            className={`btn btn-sm ${activeTab === 'donors' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('donors')}
          >
            <PhoneCall size={16} /> Phone Number & Donor View ({donorsByPhone.length})
          </button>
          <button
            className={`btn btn-sm ${activeTab === 'careof' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('careof')}
          >
            <Building2 size={16} /> Care Of (C/O) Grouping ({careOfSummaries.length})
          </button>
        </div>

        {/* Search & Quick Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <div className="search-box" style={{ width: '260px' }}>
            <Search className="search-icon" size={16} />
            <input
              type="text"
              className="input-field search-input"
              placeholder="Search Phone, Name, C/O, Voucher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="input-field select-field"
            style={{ width: '190px' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All Donation Statuses</option>
            <option value="started">Donation Started</option>
            <option value="not_started">Not Started Yet</option>
            <option value="fully_paid">Fully Paid</option>
            <option value="expiring">1-Year Expiring Soon</option>
          </select>

          <select
            className="input-field select-field"
            style={{ width: '200px' }}
            value={careOfFilter}
            onChange={(e) => setCareOfFilter(e.target.value)}
          >
            <option value="all">All Care Of (C/O)</option>
            {careOfSummaries.map((co) => (
              <option key={co.careOfName} value={co.careOfName}>
                {co.careOfName} ({co.donorCount})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TAB 1: PHONE NUMBER & DONOR REPORT VIEW */}
      {activeTab === 'donors' && (
        <div className="table-container glass-panel">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th onClick={() => handleToggleSort('donorName')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    Donor Name & Phone
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th>Care Of (C/O)</th>
                <th>Sponsorship Category</th>
                <th>Donation Status</th>
                <th onClick={() => handleToggleSort('startDate')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    Starting Date
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th onClick={() => handleToggleSort('endDate')} style={{ cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    1-Year Ending Date
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th onClick={() => handleToggleSort('totalPaid')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                    Total Paid
                    <ArrowUpDown size={14} />
                  </div>
                </th>
                <th onClick={() => handleToggleSort('balanceRemaining')} style={{ cursor: 'pointer', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                    Balance
                    <ArrowUpDown size={14} />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredDonors.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No donor sponsorship records matching the current filters.
                  </td>
                </tr>
              ) : (
                filteredDonors.map((donor) => {
                  const isExpanded = expandedDonorId === donor.id;
                  return (
                    <React.Fragment key={donor.id}>
                      <tr
                        style={{ cursor: 'pointer', background: isExpanded ? 'rgba(99, 102, 241, 0.08)' : undefined }}
                        onClick={() => setExpandedDonorId(isExpanded ? null : donor.id)}
                      >
                        <td style={{ textAlign: 'center' }}>
                          {isExpanded ? <ChevronDown size={18} className="text-indigo-400" /> : <ChevronRight size={18} />}
                        </td>

                        {/* Name & Phone */}
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                            {donor.donorName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <PhoneCall size={12} /> {donor.phoneNumber}
                          </div>
                        </td>

                        {/* Care Of */}
                        <td>
                          <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                            {donor.careOf}
                          </span>
                        </td>

                        {/* Sponsorship Category */}
                        <td>
                          <div style={{ fontSize: '0.825rem', fontWeight: 600 }}>{donor.sponsorshipCategory}</div>
                          <div style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>
                            Pledge: ₹{donor.totalCommitted.toLocaleString('en-IN')}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td>
                          <span className={`badge ${donor.statusInfo.badgeClass}`} style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                            {donor.statusInfo.label}
                          </span>
                        </td>

                        {/* Start Date */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.825rem', fontWeight: 600 }}>
                            <Calendar size={14} className="text-indigo-400" />
                            {donor.startDateFormatted}
                          </div>
                        </td>

                        {/* 1-Year End Date */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.825rem', fontWeight: 600 }}>
                            <CalendarRange size={14} className="text-amber-400" />
                            {donor.endDateFormatted}
                          </div>
                        </td>

                        {/* Total Paid */}
                        <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--emerald-400)', fontSize: '0.95rem' }}>
                          ₹{donor.totalPaid.toLocaleString('en-IN')}
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {donor.transactionCount} payment(s)
                          </div>
                        </td>

                        {/* Balance */}
                        <td style={{ textAlign: 'right', fontWeight: 700, color: donor.balanceRemaining > 0 ? 'var(--amber-400)' : 'var(--text-muted)', fontSize: '0.95rem' }}>
                          ₹{donor.balanceRemaining.toLocaleString('en-IN')}
                        </td>
                      </tr>

                      {/* Expanded Drawer: Payment History & Vouchers */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} style={{ background: 'var(--bg-tertiary)', padding: '1rem 1.5rem', borderBottom: '2px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                  Payment Transactions History for {donor.donorName} ({donor.phoneNumber})
                                </span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  Calculated 1-Year Renewal Date: <strong className="text-amber-400">{donor.endDateFormatted}</strong>
                                </span>
                              </div>

                              {donor.transactions.length === 0 ? (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '0.5rem 0' }}>
                                  No transaction payment records logged yet in Form Responses.
                                </div>
                              ) : (
                                <div style={{ overflowX: 'auto' }}>
                                  <table style={{ width: '100%', fontSize: '0.8rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                                    <thead>
                                      <tr style={{ background: 'var(--bg-primary)', textTransform: 'uppercase', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        <th style={{ padding: '6px 12px' }}>Transaction Date</th>
                                        <th style={{ padding: '6px 12px' }}>Mode</th>
                                        <th style={{ padding: '6px 12px' }}>Voucher No</th>
                                        <th style={{ padding: '6px 12px' }}>Care Of</th>
                                        <th style={{ padding: '6px 12px', textAlign: 'right' }}>Amount Paid</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {donor.transactions.map((tx, idx) => (
                                        <tr key={tx.id || idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                          <td style={{ padding: '6px 12px', fontWeight: 600 }}>{tx.date}</td>
                                          <td style={{ padding: '6px 12px' }}>
                                            <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>{tx.mode}</span>
                                          </td>
                                          <td style={{ padding: '6px 12px', fontFamily: 'monospace' }}>{tx.voucherNo}</td>
                                          <td style={{ padding: '6px 12px' }}>{tx.careOf}</td>
                                          <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--emerald-400)' }}>
                                            ₹{tx.amount.toLocaleString('en-IN')}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: CARE OF (C/O) GROUPING AGGREGATIONS VIEW */}
      {activeTab === 'careof' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {careOfSummaries.map((co) => {
            const isExpanded = expandedCareOfName === co.careOfName;
            return (
              <div key={co.careOfName} className="glass-panel" style={{ padding: '1.25rem', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      {co.careOfName}
                    </h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {co.donorCount} Donors / Students Sponsored
                    </span>
                  </div>
                  <span className="badge badge-primary" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                    {co.progressPercent}% Target
                  </span>
                </div>

                {/* Progress Bar */}
                <div style={{ width: '100%', height: '8px', background: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${co.progressPercent}%`,
                      background: 'var(--accent-gradient)',
                      borderRadius: '4px',
                    }}
                  />
                </div>

                {/* Amounts Breakdown */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.825rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>COLLECTED</div>
                    <div style={{ fontWeight: 800, color: 'var(--emerald-400)', fontSize: '0.95rem' }}>
                      ₹{co.totalCollected.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>COMMITTED</div>
                    <div style={{ fontWeight: 800, color: 'var(--indigo-400)', fontSize: '0.95rem' }}>
                      ₹{co.totalCommitted.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Toggle Donor Drawer */}
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setExpandedCareOfName(isExpanded ? null : co.careOfName)}
                >
                  {isExpanded ? 'Hide Donors List' : `View All ${co.donors.length} Donors`}
                </button>

                {isExpanded && (
                  <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                    {co.donors.map((d) => (
                      <div key={d.id} style={{ background: 'var(--bg-secondary)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{d.donorName}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Start: {d.startDateFormatted}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, color: 'var(--emerald-400)' }}>₹{d.totalPaid.toLocaleString('en-IN')}</div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Bal: ₹{d.balanceRemaining.toLocaleString('en-IN')}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
