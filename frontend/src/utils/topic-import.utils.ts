import type { TopicImportPreviewRow } from "@/types/features/content";
import { topicFormSchema } from "@/schemas/topic.schema";
import { normalizeSubjectIdentity } from "@/utils/subject-identity.utils";

/**
 * Re-validates interactive import preview rows using the shared Zod topic schema,
 * normalized (code, version) uniqueness across the table, and preserved backend DB conflict flags.
 */
export function validateTopicImportRows(
  currentRows: TopicImportPreviewRow[],
  baseOriginal: TopicImportPreviewRow[] = []
): TopicImportPreviewRow[] {
  const seenKeys = new Map<string, number>();

  return currentRows.map((row, idx) => {
    const parsed = topicFormSchema.safeParse({
      code: row.code ?? "",
      name: row.name ?? "",
      version: row.version ?? "",
      technicalGroup: row.technicalGroup ?? "",
      durationHours: row.durationHours ?? "",
      description: row.description ?? "",
      isActive: row.status !== "INACTIVE",
    });

    const errors: string[] = parsed.success
      ? []
      : parsed.error.issues.map((issue) => issue.message);

    const normalized = normalizeSubjectIdentity({
      code: (row.code || "").trim(),
      version: (row.version || "").trim(),
    });

    if (normalized.code && normalized.version) {
      const key = `${normalized.code}#${normalized.version}`;
      if (seenKeys.has(key)) {
        errors.push(
          `Duplicate Code '${normalized.code}' and Version '${normalized.version}' with row #${seenKeys.get(key)}`
        );
      } else {
        seenKeys.set(key, row.rowNumber || idx + 1);
      }
    }

    const hadDbConflict = row.errors?.some((e) => e.toLowerCase().includes("already exists"));
    if (hadDbConflict) {
      const orig = baseOriginal.find((o) => o.rowNumber === row.rowNumber);
      const origNormalized = orig
        ? normalizeSubjectIdentity({
            code: (orig.code || "").trim(),
            version: (orig.version || "").trim(),
          })
        : null;

      if (
        origNormalized &&
        origNormalized.code === normalized.code &&
        origNormalized.version === normalized.version
      ) {
        errors.push(
          `Topic with Code '${normalized.code}' and Version '${normalized.version}' already exists in system.`
        );
      }
    }

    const distinctErrors = Array.from(new Set(errors));
    return {
      ...row,
      valid: distinctErrors.length === 0,
      errors: distinctErrors,
    };
  });
}
