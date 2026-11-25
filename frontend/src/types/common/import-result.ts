export interface ImportError {

  rowNumber: number;

  message: string;
}

export interface ImportResult {

  /** Tß╗òng sß╗æ d├▓ng dß╗» liß╗çu ─æß╗ìc ─æ╞░ß╗úc trong file import */
  totalCount?: number;

  successCount: number;

  failureCount: number;

  errors: ImportError[];
}
