export interface SheetsCell {
  v?: any;
  f?: string | null;
}

export interface SheetsRow {
  c?: SheetsCell[];
}

export interface SheetsData {
  table?: {
    rows?: SheetsRow[];
  };
}

export type SheetsResponse = unknown;
