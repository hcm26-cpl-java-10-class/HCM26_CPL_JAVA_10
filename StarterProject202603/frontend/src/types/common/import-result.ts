export interface ImportError {

  rowNumber: number;

  message: string;
}

export interface ImportResult {

  successCount: number;

  failureCount: number;
  
  errors: ImportError[];
}

// HTTP error bodies are not necessarily import results. Validate at runtime.
export function isImportResult(value: unknown): value is ImportResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  const isCount = (count: unknown) =>
    typeof count === "number" && Number.isInteger(count) && count >= 0;

  return (
    isCount(result.successCount) &&
    isCount(result.failureCount) &&
    Array.isArray(result.errors) &&
    result.errors.every(
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        isCount((error as Record<string, unknown>).rowNumber) &&
        typeof (error as Record<string, unknown>).message === "string",
    )
  );
}
