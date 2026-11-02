/** Match the backend's whitespace-delimited word counting, including Unicode spaces. */
export function countWords(value: unknown): number {
  return typeof value === "string" ? (value.match(/[^\s\p{Z}\uFEFF]+/gu)?.length ?? 0) : 0;
}

export function wordLimitError(value: unknown, limit: number | undefined, label: string): string | undefined {
  return limit !== undefined && countWords(value) > limit
    ? `${label} must not exceed ${limit} words`
    : undefined;
}
