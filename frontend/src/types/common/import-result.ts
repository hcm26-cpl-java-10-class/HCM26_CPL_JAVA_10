export interface ImportError {

  rowNumber: number;

  message: string;
}

export interface ImportResult {

  /** Tổng số dòng dữ liệu đọc được trong file import */
  totalCount?: number;

  successCount: number;

  failureCount: number;

  errors: ImportError[];
}