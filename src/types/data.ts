export type ColumnType = 'text' | 'number' | 'date' | 'email' | 'status' | 'rating' | 'boolean' | 'currency';

export interface ColumnSchema {
  id: string; // Original header key
  label: string; // Display title
  type: ColumnType;
  visible: boolean;
  order: number;
  options?: string[]; // Unique values for status/dropdown filters
}

export type RowData = Record<string, string | number | boolean | null>;

export interface SortRule {
  columnId: string;
  direction: 'asc' | 'desc';
}

export type FilterOperator = 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between' | 'in';

export interface FilterRule {
  id: string;
  columnId: string;
  operator: FilterOperator;
  value: string | number | boolean | string[];
}

export interface SavedView {
  id: string;
  name: string;
  filters: FilterRule[];
  sortRules: SortRule[];
  groupByColumn?: string;
  hiddenColumns: string[];
}

export interface Dataset {
  id: string;
  name: string;
  description?: string;
  columns: ColumnSchema[];
  rows: RowData[];
  createdAt: string;
  updatedAt: string;
  sourceType: 'google_form' | 'google_sheet' | 'csv' | 'sample' | 'manual';
}

export interface MetricSummary {
  totalCount: number;
  filteredCount: number;
  numericAggregations: Record<string, { sum: number; avg: number; min: number; max: number }>;
  categoricalBreakdown: Record<string, Record<string, number>>;
}
