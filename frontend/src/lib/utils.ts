import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalise a user supplied external link so browsers do not resolve it against
 * the current app origin (e.g. `youtube.com` -> `https://youtube.com` instead of
 * `http://localhost:5173/management/workspaces/youtube.com`).
 * Absolute URLs and non-web schemes (`mailto:`, `tel:`...) are returned as-is.
 */
export function normalizeExternalUrl(raw?: string | null): string | undefined {
  const value = raw?.trim()
  if (!value) return undefined
  if (/^[a-z][a-z\d+.-]*:/i.test(value)) return value
  if (value.startsWith("//")) return `https:${value}`
  if (/^localhost(?::\d+)?(?:[/?#]|$)/i.test(value)) return `http://${value}`
  return `https://${value.replace(/^\/+/, "")}`
}
