type Range = { min?: number; max?: number };

/** Translate table range controls into the Subject API's named scalar filters. */
export function subjectFilters(filters: Record<string, unknown> = {}): Record<string, unknown> {
  const { durationHours, createdAt, updatedAt, ...rest } = filters;
  const hours = durationHours as Range | undefined;
  if (hours?.min !== undefined) rest.minHours = hours.min;
  if (hours?.max !== undefined) rest.maxHours = hours.max;
  for (const [value, key] of [[createdAt, "createdRange"], [updatedAt, "updatedRange"]] as const) {
    const range = value as { from?: string; to?: string } | undefined;
    if (range?.from || range?.to) rest[key] = [range.from ? `${range.from}T00:00:00` : "1970-01-01T00:00:00",
      range.to ? `${range.to}T23:59:59.999999` : "9999-12-31T23:59:59.999999"];
  }
  return rest;
}

export function subjectExportParams(format: string, search: string, filters: Record<string, unknown>, sort: string[]) {
  const params = new URLSearchParams({ format });
  if (search.trim()) params.set("search", search.trim());
  for (const entry of sort) params.append("sort", entry);
  Object.entries(subjectFilters(filters)).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, String(item));
  });
  return params;
}
