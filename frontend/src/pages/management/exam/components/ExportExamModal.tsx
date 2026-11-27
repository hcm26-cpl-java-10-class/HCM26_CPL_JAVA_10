import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, FileBarChart, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { examApi } from "@/api";
import { downloadBlob } from "@/components/datatable/util/dataio.utils";
import type { FileFormat } from "@/types";

interface ExportExamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters?: {
    search?: string;
    category?: string;
    courseId?: number;
  };
  totalCount?: number;
}

const EXPORT_OPTIONS: {
  format: FileFormat;
  label: string;
  ext: string;
  description: string;
  icon: typeof FileSpreadsheet;
  color: string;
}[] = [
  {
    format: "EXCEL",
    label: "Microsoft Excel (.xlsx)",
    ext: "xlsx",
    description: "Full assessment configuration formatted in a spreadsheet",
    icon: FileSpreadsheet,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
  },
  {
    format: "CSV",
    label: "CSV (.csv)",
    ext: "csv",
    description: "Standard comma-separated format with UTF-8 BOM encoding",
    icon: FileText,
    color: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  },
  {
    format: "PDF",
    label: "PDF Document (.pdf)",
    ext: "pdf",
    description: "Print-ready summary document in landscape table layout",
    icon: FileBarChart,
    color: "text-rose-500 bg-rose-500/10 border-rose-500/30",
  },
];

export function ExportExamModal({ open, onOpenChange, filters, totalCount = 0 }: ExportExamModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<FileFormat>("EXCEL");
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    try {
      setLoading(true);
      const ext = selectedFormat === "EXCEL" ? "xlsx" : selectedFormat.toLowerCase();
      const blob = await examApi.exportExams(selectedFormat, filters);
      
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `assessments_${dateStr}.${ext}`);
      
      toast.success(`Exported assessments successfully as .${ext}`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to export assessments");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="size-5 text-primary" />
            Export Assessments
          </DialogTitle>
          <DialogDescription>
            Choose a file format to export your assessment list ({totalCount} records matching current filters).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {EXPORT_OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSelected = selectedFormat === opt.format;

            return (
              <div
                key={opt.format}
                onClick={() => setSelectedFormat(opt.format)}
                className={`flex items-center gap-3.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 shadow-xs"
                    : "border-border/70 hover:border-primary/40 hover:bg-muted/30"
                }`}
              >
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg border ${opt.color}`}>
                  <Icon className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{opt.description}</p>
                </div>
                <div className="shrink-0">
                  <div
                    className={`size-4 rounded-full border flex items-center justify-center ${
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    }`}
                  >
                    {isSelected && <div className="size-1.5 rounded-full bg-primary-foreground" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {loading ? "Exporting..." : "Download Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
