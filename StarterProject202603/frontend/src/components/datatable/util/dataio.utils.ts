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

  const match = contentDisposition.match(/filename="?(.+?)"?$/);

  return match ? match[1] : null;
}