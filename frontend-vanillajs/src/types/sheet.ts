export interface SpreadsheetConfig {
  spreadsheetId: string;
  range: string;
  values?: string[][];
}

export interface SpreadsheetData {
  values: string[][];
}
