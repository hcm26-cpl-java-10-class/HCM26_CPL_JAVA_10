import type {
  TemplateSampleContent, TemplateSampleContentPayload, TemplateSuggestedRole,
} from "@/types/features/project-template";

export interface BacklogItemValues {
  key: string;
  id?: number;
  title: string;
  description: string;
  suggestedRole: TemplateSuggestedRole | "";
}

export interface SampleContentValues { backlogItems: BacklogItemValues[] }
export type SampleContentErrors = Record<string, string[] | undefined>;

export function newBacklogItem(input?: { title: string; description: string | null; suggestedRole: TemplateSuggestedRole }): BacklogItemValues {
  return { key: crypto.randomUUID(), title: input?.title ?? "", description: input?.description ?? "", suggestedRole: input?.suggestedRole ?? "" };
}

export function toSampleValues(content: TemplateSampleContent): SampleContentValues {
  return {
    backlogItems: content.backlogItems.map((item) => ({ ...newBacklogItem(item), id: item.id ?? undefined })),
  };
}

export function sampleFieldId(path: string) { return `sample-${path.replace(/[.[\]]+/g, "-").replace(/-$/, "")}`; }

export function validateSampleContent(values: SampleContentValues, content: TemplateSampleContent): SampleContentErrors {
  const errors: SampleContentErrors = {};
  if (values.backlogItems.length > content.maxItems) errors.backlogItems = [`A template can contain at most ${content.maxItems} backlog items`];
  values.backlogItems.forEach((item, i) => {
    const path = `backlogItems[${i}]`;
    if (!item.title.trim() || item.title.trim().length > 200) errors[`${path}.title`] = ["Backlog title must contain 1 to 200 characters"];
    if (item.description.trim().length > 2000) errors[`${path}.description`] = ["Description must not exceed 2000 characters"];
    if (!item.suggestedRole || !content.roles.includes(item.suggestedRole)) errors[`${path}.suggestedRole`] = ["Select PM, BA, DEV or QA"];
  });
  return errors;
}

export function toSamplePayload(values: SampleContentValues, lockVersion: number): TemplateSampleContentPayload {
  return {
    lockVersion,
    backlogItems: values.backlogItems.map((item) => ({ ...(item.id ? { id: item.id } : {}), title: item.title.trim(),
      description: item.description.trim(), suggestedRole: item.suggestedRole as TemplateSuggestedRole })),
  };
}
