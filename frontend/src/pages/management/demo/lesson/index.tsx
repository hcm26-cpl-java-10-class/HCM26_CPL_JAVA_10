import { lessonApi } from "@/api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type EntityConfig, type EntitySchema, auditableFieldsSchema, type FieldSchema } from "@/types";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SectionLessons } from "./components/SectionLessons";

const lessonSchema: EntitySchema = {
  entityName: "lesson",
  idField: "id",
  fields: [
    { name: "title", label: "Title", type: "text", sortable: true, bold: true },
    {
      name: "contentType",
      label: "Content Type",
      type: "select",
      sortable: true,
      options: [
        { label: "Video", value: "VIDEO" },
        { label: "Text", value: "TEXT" },
        { label: "Document", value: "DOCUMENT" },
        { label: "Link", value: "LINK" },
      ],
    },
    { name: "contentUrl", label: "Content URL", type: "text", sortable: false },
    { name: "textContent", label: "Text Content", type: "textarea", sortable: false, visible: false },
    { name: "duration", label: "Duration (s)", type: "number", sortable: true },
    { name: "orderIndex", label: "Order", type: "number", sortable: true },
    ...(auditableFieldsSchema as FieldSchema[]),
  ],
};

// build-router.ts tự đăng ký route "/lessons" từ entityConfig này
export const entityConfig: EntityConfig = {
  name: "Lesson",
  path: "/lessons",
  api: lessonApi,
  schema: lessonSchema,
};

/**
 * Trang quản lý bài học: chọn Section (qua ô nhập hoặc ?sectionId=) rồi thêm/sửa/xóa/preview.
 * Khi trang Section (M3) hoàn thiện, chỉ cần nhúng <SectionLessons sectionId={...} />.
 */
export default function LessonManagementPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = Number(searchParams.get("sectionId"));
  const [input, setInput] = useState(Number.isInteger(initial) && initial > 0 ? String(initial) : "");

  const sectionId = Number(input);
  const validSection = Number.isInteger(sectionId) && sectionId > 0;

  const handleChange = (value: string) => {
    setInput(value);
    const next = Number(value);
    if (Number.isInteger(next) && next > 0) setSearchParams({ sectionId: String(next) });
    else setSearchParams({});
  };

  return (
    <MainLayout pathName={{ lessons: "Lessons" }}>
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="grid max-w-xs gap-1.5">
          <Label htmlFor="section-id">Section ID</Label>
          <Input
            id="section-id"
            type="number"
            min={1}
            value={input}
            placeholder="Enter a section id"
            onChange={(e) => handleChange(e.target.value)}
          />
        </div>

        {validSection ? (
          <SectionLessons key={sectionId} sectionId={sectionId} />
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            Enter a Section ID to manage its lessons.
          </div>
        )}
      </div>
    </MainLayout>
  );
}
