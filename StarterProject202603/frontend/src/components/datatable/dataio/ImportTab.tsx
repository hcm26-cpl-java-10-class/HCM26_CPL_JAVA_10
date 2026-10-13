import { downloadTemplate } from "@/api/features/dataio/dataio-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import { Download, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface ImportTabProps {
  loading: boolean;
  onImport: (file: File) => Promise<void>;
  entityName?: string;
}

export function ImportTab({ loading, onImport, entityName }: ImportTabProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    if (
      !file.name.endsWith(".xlsx") &&
      !file.name.endsWith(".xls") &&
      !file.name.endsWith(".csv")
    ) {
      setError("Only Excel or CSV files (.xlsx, .xls, .csv) are allowed");
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("File size must be less than 50MB");
      return false;
    }

    return true;
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) return;
    if (!validateFile(file)) return;

    setFile(file);
    setError(null);
  };

  const handleImportClick = async () => {
    if (!file || loading) return;

    try {
      setError(null);
      await onImport(file);
      clearFile();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to import data");
    }
  };

  const handleDownloadTemplate = async () => {
    if (!entityName) return;

    try {
      setDownloadingTemplate(true);
      await downloadTemplate(entityName);
      toast.success("Template downloaded successfully");
    } catch (error) {
      console.error("Error downloading template:", error);
      toast.error("Unable to download template. Please try again.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (loading) return;
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    if (loading) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (loading) return;
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    handleFileSelect(droppedFile ?? null);
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <TabsContent value="import" className="mt-4 flex-1 flex flex-col gap-4">
      {entityName && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex-1">
            <p className="text-sm font-medium">Download Template</p>
            <p className="text-xs text-muted-foreground mt-1">
              Download Excel template to see data format
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate || loading}
            className="gap-2"
          >
            {downloadingTemplate ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {!file && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            flex flex-col items-center justify-center flex-1
            border-2 border-dashed rounded-xl p-8 text-center gap-3
            transition-colors cursor-pointer
            ${isDragging ? "border-blue-600 bg-blue-50 dark:bg-blue-950" : "border-muted hover:border-primary hover:bg-accent"}
            ${loading ? "opacity-50 pointer-events-none" : ""}
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">Click to upload or drag and drop</p>
          <p className="text-xs text-muted-foreground">
            Excel or CSV files (.xlsx, .xls, .csv) up to 50MB
          </p>

          <Input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            disabled={loading}
            onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
          />
        </div>
      )}

      {file && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
            <FileSpreadsheet className="h-5 w-5 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFile}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button
            className="w-full bg-primary hover:bg-primary/80 text-white mt-auto"
            onClick={handleImportClick}
            disabled={!file || loading}
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-5 w-5" />
                Import File
              </>
            )}
          </Button>
        </div>
      )}
    </TabsContent>
  );
}

