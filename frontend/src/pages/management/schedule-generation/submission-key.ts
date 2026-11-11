export interface BulkSubmission {
  payload: string;
  key: string;
}

/** Reuse a key for retries of the same class/data, including after a lost response. */
export function getBulkSubmission(
  previous: BulkSubmission | null,
  classId: number,
  sessions: unknown[],
  createKey: () => string = () => crypto.randomUUID(),
): BulkSubmission {
  const payload = JSON.stringify({ classId, sessions });
  return previous?.payload === payload ? previous : { payload, key: createKey() };
}
