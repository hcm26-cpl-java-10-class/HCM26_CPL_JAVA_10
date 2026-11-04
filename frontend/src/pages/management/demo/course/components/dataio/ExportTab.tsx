import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import type { FileFormat } from "@/types";
import {
  Download,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Loader2,
} from "lucide-react";
import { useState } from "react";

const exportOptions = [
  {
    format: "EXCEL" as FileFormat,
    label: "Excel",
    description: "Download as Excel file (.xlsx)",
    icon: FileSpreadsheet,
  },
  {
    format: "CSV" as FileFormat,
    label: "CSV",
    description: "Download as CSV file (.csv)",
    icon: FileText,
  },
  {
    format: "PDF" as FileFormat,
    label: "PDF",
    description: "Download as PDF file (.pdf)",
    icon: FileBarChart,
  },
];

interface ExportTabProps {
  loading: boolean;
  onExport: (format: FileFormat) => Promise<void>;
}

export function ExportTab({ loading, onExport }: ExportTabProps) {
  const [selectedFormat, setSelectedFormat] = useState<FileFormat | null>(null);

  const handleExportClick = async () => {
    if (!selectedFormat || loading) return;

    try {
      await onExport(selectedFormat);
      setSelectedFormat(null);
    } catch (error) {
      console.error("Export error:", error);
    }
  };

  return (
    <TabsContent value="export" className="mt-4 flex-1 flex flex-col gap-4">
      <div className="text-center">
        <h1 className="text-[16px] font-semibold">Select Export Format</h1>
        <p className="text-sm text-muted-foreground">
          Choose the format for your exported data
        </p>
      </div>

      <div className="space-y-2">
        {exportOptions.map((option) => {
          const IconComponent = option.icon;
          return (
            <div
              key={option.format}
              className={`p-3 cursor-pointer transition-all hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl border-2 ${
                selectedFormat === option.format
                  ? "bg-gray-200 dark:bg-gray-700 border-primary"
                  : "hover:border-primary/50"
              }`}
              onClick={() => setSelectedFormat(option.format)}
            >
              <div className="flex items-center gap-4">
                <IconComponent className="h-8 w-8 text-gray-500" />
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{option.label}</h4>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="export-format"
                    value={option.format}
                    checked={selectedFormat === option.format}
                    onChange={() => setSelectedFormat(option.format)}
                    className="h-4 w-4 text-primary"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Button
        className="w-full bg-primary hover:bg-primary/80 text-white mt-auto"
        onClick={handleExportClick}
        disabled={!selectedFormat || loading}
        size="lg"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Exporting...
          </>
        ) : (
          <>
            <Download className="mr-2 h-5 w-5" />
            Export File
          </>
        )}
      </Button>
    </TabsContent>
  );
}
