import { useState } from "react";
import { Download, FileBarChart, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { topicApi } from "@/api/features/topic.api";

type ExportFormat = "EXCEL" | "CSV" | "PDF";

interface TopicExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
}

const exportOptions = [
  {
    format: "EXCEL" as ExportFormat,
    label: "Excel",
    description: "Download as Excel file (.xlsx)",
    ext: "xlsx",
    icon: FileSpreadsheet,
  },
  {
    format: "CSV" as ExportFormat,
    label: "CSV",
    description: "Download as CSV file (.csv)",
    ext: "csv",
    icon: FileText,
  },
  {
    format: "PDF" as ExportFormat,
    label: "PDF",
    description: "Download as PDF file (.pdf)",
    ext: "pdf",
    icon: FileBarChart,
  },
];

export function TopicExportDialog({
  open,
  onOpenChange,
  title = "Export Topics",
  description = "Choose output format and export your records",
}: TopicExportDialogProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("EXCEL");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    if (!selectedFormat || isExporting) return;

    try {
      setIsExporting(true);
      const blob = await topicApi.exportFile(selectedFormat);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const opt = exportOptions.find((o) => o.format === selectedFormat);
      const ext = opt?.ext || "xlsx";
      a.download = `topics_${new Date().toISOString().slice(0, 10)}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success(`Đã xuất file ${opt?.label || selectedFormat} thành công!`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Xuất file thất bại");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="pb-1">
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <div className="text-center space-y-0.5">
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Select Export Format
            </h3>
            <p className="text-xs text-muted-foreground">
              Choose the format for your exported data
            </p>
          </div>

          {/* 3 Radio Selection Cards */}
          <div className="space-y-2.5">
            {exportOptions.map((option) => {
              const Icon = option.icon;
              const isSelected = selectedFormat === option.format;

              return (
                <div
                  key={option.format}
                  onClick={() => setSelectedFormat(option.format)}
                  className={`
                    p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3.5
                    ${
                      isSelected
                        ? "border-gray-800 dark:border-gray-300 bg-gray-50/70 dark:bg-gray-800/60 shadow-sm"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-card"
                    }
                  `}
                >
                  <div className="p-2 rounded-lg bg-muted text-gray-700 dark:text-gray-300">
                    <Icon className="h-6 w-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                      {option.label}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {option.description}
                    </p>
                  </div>

                  {/* Radio indicator */}
                  <div className="pr-1 flex items-center justify-center">
                    <div
                      className={`
                        w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all
                        ${
                          isSelected
                            ? "border-gray-900 dark:border-gray-100"
                            : "border-gray-300 dark:border-gray-600"
                        }
                      `}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-gray-900 dark:bg-gray-100" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Export File Button */}
          <Button
            type="button"
            onClick={handleExport}
            disabled={!selectedFormat || isExporting}
            className="w-full h-11 bg-[#767676] hover:bg-gray-700 text-white font-medium gap-2 rounded-xl text-sm transition-colors mt-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang xuất file...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Export File
              </>
            )}
          </Button>
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            className="rounded-lg text-sm px-5"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

