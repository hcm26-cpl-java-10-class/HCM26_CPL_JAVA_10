import { useState } from "react";
import { ArrowLeft, BookOpen, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { topicApi } from "@/api/features/topic.api";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { useTopicSyllabus } from "@/hooks/useTopics";
import type { TopicItem } from "@/types/features/content";
import { describeApiError } from "@/utils/api-error.utils";
import { triggerBlobDownload } from "@/utils/file-download.utils";
import { exportStandardSyllabusCsv } from "./syllabusParser";
import { resolveTopicSyllabusPackage } from "./topicSyllabusData";
import { TopicDetailContent } from "./TopicDetailContent";

interface TopicDetailViewProps {
  topic: TopicItem;
  onBack: () => void;
  onEdit?: (topic: TopicItem) => void;
}

export function TopicDetailView({ topic, onBack, onEdit }: TopicDetailViewProps) {
  const { canAccessResource } = usePermissions();
  const canUpdate = canAccessResource("SUBJECT", "UPDATE");
  const canExport = canAccessResource("SUBJECT", "READ");

  const [isOutlineEditorOpen, setIsOutlineEditorOpen] = useState(false);
  const [isSyllabusImportOpen, setIsSyllabusImportOpen] = useState(false);
  const { data: serverSyllabus } = useTopicSyllabus(topic.id);

  const handleExportCsv = () => {
    try {
      const currentPkg = resolveTopicSyllabusPackage(topic, serverSyllabus);
      const csvContent = exportStandardSyllabusCsv(topic, currentPkg);
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      triggerBlobDownload(blob, `${topic.code}_Syllabus_v${topic.version || "1.0"}.csv`);
      toast.success("Exported official Syllabus CSV successfully!");
    } catch {
      toast.error("Failed to export syllabus CSV");
    }
  };

  const handleDownloadExcel = async () => {
    try {
      const blob = await topicApi.exportFile("EXCEL");
      triggerBlobDownload(blob, `${topic.code}_Syllabus_v${topic.version || "1.0"}.xlsx`);
      toast.success("Download started!");
    } catch (err) {
      toast.error(describeApiError(err, "Download failed").message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-1.5 text-gray-600 hover:text-gray-900 -ml-2 text-xs"
        >
          <ArrowLeft className="size-4" />
          Back to Topics &amp; Syllabus
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          {canUpdate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSyllabusImportOpen(true)}
              className="text-gray-700 hover:text-indigo-600 hover:border-indigo-300 gap-1.5 text-xs h-8"
            >
              <Upload className="size-3.5 text-indigo-600" />
              Import Syllabus (CSV)
            </Button>
          )}

          {canExport && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="text-gray-700 hover:text-indigo-600 hover:border-indigo-300 gap-1.5 text-xs h-8"
            >
              <Download className="size-3.5 text-indigo-600" />
              Export Syllabus CSV
            </Button>
          )}

          {canUpdate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsOutlineEditorOpen(true)}
              className="text-gray-700 hover:text-[#5b52e0] hover:border-[#5b52e0] gap-1.5 text-xs h-8"
            >
              <BookOpen className="size-3.5 text-[#5b52e0]" />
              Edit Outline
            </Button>
          )}

          {onEdit && canUpdate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEdit(topic)}
              className="text-gray-700 text-xs h-8"
            >
              Edit Topic
            </Button>
          )}

          {canExport && (
            <Button
              type="button"
              onClick={handleDownloadExcel}
              className="bg-[#5b52e0] hover:bg-[#4d44cb] text-white px-4 h-8 rounded-lg font-medium shadow-sm gap-1.5 text-xs"
            >
              <Download className="size-3.5" />
              Download Excel
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-6">
        <TopicDetailContent
          topic={topic}
          canUpdate={canUpdate}
          outlineEditorOpen={isOutlineEditorOpen}
          onOutlineEditorOpenChange={setIsOutlineEditorOpen}
          syllabusImportOpen={isSyllabusImportOpen}
          onSyllabusImportOpenChange={setIsSyllabusImportOpen}
        />
      </div>
    </div>
  );
}

