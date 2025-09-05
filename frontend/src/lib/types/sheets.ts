export interface SheetsCell {
  v?: string | number | Date | null;
  f?: string | null;
}

export interface SheetsRow {
  c?: SheetsCell[];
  rowIndex?: number;
}

export interface SheetsData {
  table?: {
    cols?: string[];
    rows?: SheetsRow[];
  };
  metadata?: {
    lastUpdated?: string;
    version?: number;
  };
}

export interface SheetsResponse extends SheetsData {}

export interface SheetsQuery {
  spreadsheetId: string;
  sheetName: string;
  query: string;
  headers?: Record<string, string>;
}

export type SheetsOperation = "SELECT" | "INSERT" | "UPDATE" | "DELETE";
