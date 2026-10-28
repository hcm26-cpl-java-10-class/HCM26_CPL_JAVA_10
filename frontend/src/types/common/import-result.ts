export interface ImportError {

  rowNumber: number;

  message: string;
}

export interface ImportResult {

  successCount: number;

  failureCount: number;
  
  errors: ImportError[];
}
/** Server-validated data shown before any rows are saved. */
export interface ImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  canImport: boolean;
  columns: string[];
  requiredColumns?: string[];
  warnings?: string[];
  rules?: string[];
  rows: {
    rowNumber: number;
    values: Record<string, string | null>;
    valid: boolean;
    errors: string[];
  }[];
}

export interface ImportInputRow {
  rowNumber: number;
  values: Record<string, string | null>;
}
