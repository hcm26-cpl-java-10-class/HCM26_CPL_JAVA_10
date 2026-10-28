export interface ImportError {

  rowNumber: number;

  message: string;
}

export interface ImportResult {

  successCount: number;

  failureCount: number;

  rolledBack?: boolean;
  
  errors: ImportError[];
}