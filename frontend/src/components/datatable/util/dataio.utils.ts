export function downloadBlob(blob: Blob, filename?: string) {
  const url = window.URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;

  link.download = filename || "download";

  document.body.appendChild(link);
  link.click();

  link.remove();
  window.URL.revokeObjectURL(url);
}

export function getFilenameFromHeader(
  contentDisposition?: string | null
) {
  if (!contentDisposition) return null;

  // Try filename*= (RFC 5987, e.g. filename*=UTF-8''course-template.xlsx)
  const encodedMatch = contentDisposition.match(/filename\*\s*=\s*(?:UTF-8'')?([^;\r\n]+)/i);
  if (encodedMatch) {
    try {
      return decodeURIComponent(encodedMatch[1].trim().replace(/"/g, ""));
    } catch {
      // fall through to plain filename
    }
  }

  // Try filename="..." or filename=...
  const plainMatch = contentDisposition.match(/filename\s*=\s*"([^"]+)"|filename\s*=\s*([^;\r\n]+)/i);
  if (plainMatch) {
    return (plainMatch[1] ?? plainMatch[2] ?? "").trim();
  }

  return null;
}