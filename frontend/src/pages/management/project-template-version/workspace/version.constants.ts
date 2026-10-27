import type {
  ProjectTemplateVersionDTO,
  ProjectTemplateVersionStatus,
} from "@/types";

/** Short date (dd MMM yyyy) used by the workspace ribbon and list rows. */
export const formatDate = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** Date + time (dd MMM yyyy, HH:mm) used for created/updated timestamps. */
export const formatDateTime = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

/** Parsed snapshot payload, or `null` when the stored value is not valid JSON. */
export const parseContent = (
  contentJson?: string | null,
): Record<string, unknown> | null => {
  if (!contentJson) return null;

  try {
    const parsed = JSON.parse(contentJson);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

/** Keys of the snapshot payload, used for the compact "sections" chips. */
export const contentKeys = (version?: ProjectTemplateVersionDTO | null) => {
  const parsed = parseContent(version?.contentJson);
  return parsed ? Object.keys(parsed) : [];
};

/**
 * Human readable label of a version row (`v1.0 · Capstone Template`).
 * Falls back to the raw `template_id` while the owner is unknown.
 */
export const versionLabel = (version?: ProjectTemplateVersionDTO | null) => {
  if (!version) return "—";
  const owner = version.templateName?.trim() || `TPL-${version.templateId ?? "—"}`;
  return `${version.version ?? `#${version.id}`} · ${owner}`;
};

/**
 * US-07: resolves `parentTemplateId` (the `snapshot_id` of the version a row
 * was derived from) into its business version label, so the UI can show
 * `Derived from v1.0` instead of an opaque identifier.
 */
export const parentVersionLabel = (
  versions: ProjectTemplateVersionDTO[],
  parentTemplateId?: number | null,
) => {
  if (parentTemplateId == null) return null;

  const parent = versions.find((item) => item.id === parentTemplateId);

  return parent?.version?.trim() || `#${parentTemplateId}`;
};

export const activeMeta = (isActive?: boolean) =>
  isActive
    ? {
        label: "Active",
        badge:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
        dot: "bg-emerald-500",
      }
    : {
        label: "Inactive",
        badge: "border-border bg-muted text-muted-foreground",
        dot: "bg-muted-foreground",
      };

/**
 * Badge metadata of the version lifecycle status (US-07).
 * A newly created version is always `DRAFT`.
 */
export const statusMeta = (status?: ProjectTemplateVersionStatus | null) => {
  switch (status) {
    case "PUBLISHED":
      return {
        label: "Published",
        badge:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
        dot: "bg-emerald-500",
      };
    case "ARCHIVED":
      return {
        label: "Archived",
        badge: "border-border bg-muted text-muted-foreground",
        dot: "bg-muted-foreground",
      };
    case "DRAFT":
    default:
      return {
        label: "Draft",
        badge:
          "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
        dot: "bg-amber-500",
      };
  }
};

/** Version label convention understood by the backend (`v<major>[.<minor>]`). */
const VERSION_LABEL_PATTERN = /^[vV]?(\d+)(?:\.(\d+))?$/;

/**
 * Client-side preview of the label the backend will assign to the next version
 * of a template (`v1.0 -> v2.0`). The server remains the source of truth; this
 * is only used to explain the action in the confirmation dialog.
 */
export const nextVersionLabel = (
  versions: ProjectTemplateVersionDTO[],
  templateId?: number | null,
) => {
  const labels = (templateId == null
    ? versions
    : versions.filter((item) => item.templateId === templateId)
  )
    .map((item) => item.version?.trim())
    .filter((label): label is string => !!label);

  let highestMajor = -1;
  let parsedAny = false;

  for (const label of labels) {
    const match = VERSION_LABEL_PATTERN.exec(label);
    if (!match) continue;

    const major = Number.parseInt(match[1], 10);
    if (!Number.isFinite(major)) continue;

    parsedAny = true;
    highestMajor = Math.max(highestMajor, major);
  }

  const nextMajor = parsedAny ? highestMajor + 1 : labels.length + 1;

  return `v${nextMajor}.0`;
};
