/**
 * The text to show for a failed request. The server answers a validation problem with a short
 * "Validation failed" plus the details per field in `errors`; the details are what tells the person
 * what to fix, so they are put in the text.
 */
export function apiErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data;
  const errors = data?.errors;

  if (errors && typeof errors === "object") {
    const lines = Object.entries(errors).flatMap(([field, messages]) =>
      (Array.isArray(messages) ? messages : [String(messages)]).map((message) => `${field}: ${message}`),
    );
    if (lines.length > 0) {
      return lines.join("; ");
    }
  }

  return data?.message ?? fallback;
}
