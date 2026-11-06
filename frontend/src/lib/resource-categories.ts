/**
 * Shared catalog of resource categories used by every resource dialog
 * (project template version resources + workspace resources).
 *
 * `value` is what gets persisted to the backend (`category` column, max 50
 * chars), so it must stay short and stable. `label`/`labelVi` are display-only.
 */
export interface ResourceCategoryOption {
  value: string;
  label: string;
  labelVi: string;
}

export const RESOURCE_CATEGORIES: readonly ResourceCategoryOption[] = [
  { value: "Docs", label: "Docs & Specifications", labelVi: "Tài liệu & Đặc tả" },
  { value: "Specification", label: "Requirements / Specification", labelVi: "Yêu cầu / Đặc tả" },
  { value: "Design", label: "Design & Prototype", labelVi: "Thiết kế & Prototype" },
  { value: "Repository", label: "Source Repository (Git)", labelVi: "Kho mã nguồn (Git)" },
  { value: "Code", label: "Code Sample / Snippet", labelVi: "Mã mẫu / Snippet" },
  { value: "API", label: "API & Integration", labelVi: "API & Tích hợp" },
  { value: "Database", label: "Database & Schema", labelVi: "Cơ sở dữ liệu & Schema" },
  { value: "Architecture", label: "Architecture & Diagrams", labelVi: "Kiến trúc & Sơ đồ" },
  { value: "Sprint", label: "Sprint & Planning", labelVi: "Kế hoạch & Sprint" },
  { value: "Backlog", label: "Backlog & Tasks", labelVi: "Backlog & Công việc" },
  { value: "Meeting", label: "Meeting Notes", labelVi: "Biên bản họp" },
  { value: "Report", label: "Reports", labelVi: "Báo cáo" },
  { value: "Presentation", label: "Presentation / Slides", labelVi: "Bài trình bày / Slide" },
  { value: "Spreadsheet", label: "Spreadsheet / Data", labelVi: "Bảng tính / Dữ liệu" },
  { value: "Testing", label: "Testing & QA", labelVi: "Kiểm thử & QA" },
  { value: "Bug", label: "Bugs & Issue Tracking", labelVi: "Lỗi & Theo dõi lỗi" },
  { value: "Deployment", label: "Deployment & Release", labelVi: "Triển khai & Phát hành" },
  { value: "Config", label: "Environment & Config", labelVi: "Môi trường & Cấu hình" },
  { value: "Research", label: "Research & Reference", labelVi: "Nghiên cứu & Tham khảo" },
  { value: "Tutorial", label: "Tutorial & Learning", labelVi: "Hướng dẫn & Học tập" },
  { value: "Video", label: "Video / Recording", labelVi: "Video / Bản ghi" },
  { value: "Asset", label: "Media & Assets", labelVi: "Media & Tệp đính kèm" },
  { value: "Template", label: "Templates & Checklists", labelVi: "Mẫu & Checklist" },
  { value: "Communication", label: "Communication", labelVi: "Kênh liên lạc" },
  { value: "Feedback", label: "Client Feedback", labelVi: "Phản hồi khách hàng" },
  { value: "Security", label: "Security", labelVi: "Bảo mật" },
  { value: "Legal", label: "Legal & Compliance", labelVi: "Pháp lý & Tuân thủ" },
  { value: "Training", label: "Training & Onboarding", labelVi: "Đào tạo & Onboarding" },
  { value: "Other", label: "Other", labelVi: "Khác" },
];

/** Sentinel used by `<Select>` because Radix does not accept an empty string value. */
export const RESOURCE_CATEGORY_NONE = "__none";

export function isKnownResourceCategory(value?: string | null) {
  const trimmed = value?.trim();
  return !!trimmed && RESOURCE_CATEGORIES.some((category) => category.value === trimmed);
}

/** Display label for a stored value; unknown (legacy) values are shown as-is. */
export function resourceCategoryLabel(value?: string | null, locale: "en" | "vi" = "en") {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const match = RESOURCE_CATEGORIES.find((category) => category.value.toLowerCase() === trimmed.toLowerCase());
  if (!match) return trimmed;
  return locale === "vi" ? match.labelVi : match.label;
}
