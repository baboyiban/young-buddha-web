export type SheetsCell = { v?: any; f?: string | null };
export type SheetsRow = { c?: SheetsCell[] };
export type SheetsData = { table?: { rows?: SheetsRow[] } };
