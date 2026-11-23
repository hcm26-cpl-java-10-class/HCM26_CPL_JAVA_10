/** Match the backend identity: uppercase code; optional v before a numeric version. */
export function normalizeSubjectIdentity<T extends { code?: string; version?: string }>(data: T): T {
  const normalized = { ...data };
  if (typeof data.code === "string") normalized.code = data.code.trim().toUpperCase();
  if (typeof data.version === "string") {
    normalized.version = data.version.trim().toLowerCase().replace(/^v(?=\d)/, "");
  }
  return normalized;
}
