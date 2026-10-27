import type {
  TemplateArtifactType, TemplateSampleContent, TemplateSampleContentPayload, TemplateSuggestedRole,
} from "@/types/features/project-template";

export interface BacklogItemValues {
  key: string;
  id?: number;
  title: string;
  description: string;
  suggestedRole: TemplateSuggestedRole | "";
}

export interface ArtifactValues {
  key: string;
  id?: number;
  milestoneId: string;
  title: string;
  description: string;
  type: TemplateArtifactType;
  allowedMimeTypes: string[];
}

export interface SampleContentValues { backlogItems: BacklogItemValues[]; artifacts: ArtifactValues[] }
export type SampleContentErrors = Record<string, string[] | undefined>;

export const artifactMimeLabels: Record<string, string> = {
  "application/pdf": "PDF (.pdf)", "application/zip": "ZIP (.zip)", "image/png": "PNG (.png)",
  "image/jpeg": "JPEG (.jpg, .jpeg)", "text/plain": "Text (.txt)",
};

export function newBacklogItem(input?: { title: string; description: string | null; suggestedRole: TemplateSuggestedRole }): BacklogItemValues {
  return { key: crypto.randomUUID(), title: input?.title ?? "", description: input?.description ?? "", suggestedRole: input?.suggestedRole ?? "" };
}

export function newArtifact(): ArtifactValues {
  return { key: crypto.randomUUID(), milestoneId: "", title: "", description: "", type: "FILE", allowedMimeTypes: [] };
}

export function toSampleValues(content: TemplateSampleContent): SampleContentValues {
  return {
    backlogItems: content.backlogItems.map((item) => ({ ...newBacklogItem(item), id: item.id })),
    artifacts: content.artifacts.map((item) => ({ key: `artifact-${item.id}`, id: item.id, milestoneId: String(item.milestoneId),
      title: item.title, description: item.description ?? "", type: item.type, allowedMimeTypes: [...item.allowedMimeTypes] })),
  };
}

export function sampleFieldId(path: string) { return `sample-${path.replace(/[.[\]]+/g, "-").replace(/-$/, "")}`; }

export function validateSampleContent(values: SampleContentValues, content: TemplateSampleContent): SampleContentErrors {
  const errors: SampleContentErrors = {};
  if (values.backlogItems.length > content.maxItems) errors.backlogItems = [`A template can contain at most ${content.maxItems} backlog items`];
  if (values.artifacts.length > content.maxItems) errors.artifacts = [`A template can contain at most ${content.maxItems} artifact requirements`];
  values.backlogItems.forEach((item, i) => {
    const path = `backlogItems[${i}]`;
    if (!item.title.trim() || item.title.trim().length > 200) errors[`${path}.title`] = ["Backlog title must contain 1 to 200 characters"];
    if (item.description.trim().length > 2000) errors[`${path}.description`] = ["Description must not exceed 2000 characters"];
    if (!item.suggestedRole || !content.roles.includes(item.suggestedRole)) errors[`${path}.suggestedRole`] = ["Select PM, BA, DEV or QA"];
  });
  values.artifacts.forEach((item, i) => {
    const path = `artifacts[${i}]`;
    if (!item.title.trim() || item.title.trim().length > 120) errors[`${path}.title`] = ["Artifact name must contain 1 to 120 characters"];
    if (item.description.trim().length > 1000) errors[`${path}.description`] = ["Description must not exceed 1000 characters"];
    if (!content.milestones.some((milestone) => String(milestone.id) === item.milestoneId)) errors[`${path}.milestoneId`] = ["Select a saved milestone from this template"];
    if (item.type === "FILE" && (!item.allowedMimeTypes.length || item.allowedMimeTypes.some((type) => !content.supportedMimeTypes.includes(type)))) {
      errors[`${path}.allowedMimeTypes`] = ["Select one or more supported file formats"];
    }
  });
  return errors;
}

export function toSamplePayload(values: SampleContentValues, lockVersion: number): TemplateSampleContentPayload {
  return {
    lockVersion,
    backlogItems: values.backlogItems.map((item) => ({ ...(item.id ? { id: item.id } : {}), title: item.title.trim(),
      description: item.description.trim(), suggestedRole: item.suggestedRole as TemplateSuggestedRole })),
    artifacts: values.artifacts.map((item) => ({ ...(item.id ? { id: item.id } : {}), milestoneId: Number(item.milestoneId),
      title: item.title.trim(), description: item.description.trim(), type: item.type,
      allowedMimeTypes: item.type === "FILE" ? item.allowedMimeTypes : [] })),
  };
}
