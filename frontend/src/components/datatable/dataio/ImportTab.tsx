
import { downloadTemplate } from "@/api/features/dataio/dataio-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import {
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { apiErrorMessage } from "@/utils/api-error.utils";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface ImportTabProps {
  loading: boolean;
  onImport: (file: File) => Promise<void>;
  entityName?: string;
  onPreview?: (file: File) => Promise<void>;
  previewRequired?: boolean;
  onFileChange?: (file: File | null) => void;
  onDownloadTemplate?: () => Promise<void>;
  maxFileSize?: number;
}

export function ImportTab({
  loading,
  onImport,
  entityName,
  onPreview,
  onFileChange,
  onDownloadTemplate,
  previewRequired = false,
  maxFileSize = MAX_FILE_SIZE,
}: ImportTabProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validate selected file
  const validateFile = (file: File): boolean => {
    if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
      setError("Only Excel or CSV files (.xlsx, .xls, .csv) are allowed");
      return false;
    }

    if (file.size === 0) {
      setError("Choose a non-empty file");
      return false;
    }

    if (file.size > maxFileSize) {
      setError(
        `File size must be at most ${
          maxFileSize / (1024 * 1024)
        }MB`
      );
      return false;
    }

    return true;
  };

  // Select file
  const handleFileSelect = (selectedFile: File | null) => {
    if (!selectedFile) return;

    if (!validateFile(selectedFile)) return;

    setFile(selectedFile);
    onFileChange?.(selectedFile);
    setError(null);
  };

  // Clear selected file
  const clearFile = (notify = true) => {
    setFile(null);

    if (notify) {
      onFileChange?.(null);
    }

    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Import file
  const handleImportClick = async () => {
    if (!file || loading) return;

    try {
      setError(null);

      await onImport(file);

      clearFile(false);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, "Failed to import data"));
    }
  };

  // Preview file
  const handlePreviewClick = async () => {
    if (!file || loading || !onPreview) return;

    try {
      setError(null);

      await onPreview(file);
    } catch (err: unknown) {
      setError(apiErrorMessage(err, "Unable to preview the file"));
    }
  };

  // Download template
  const handleDownloadTemplate = async () => {
    if (!entityName && !onDownloadTemplate) return;

    try {
      setDownloadingTemplate(true);

      if (onDownloadTemplate) {
        await onDownloadTemplate();
      } else {
        await downloadTemplate(entityName!);
      }

      toast.success("Template downloaded successfully");
    } catch (error) {
      console.error("Error downloading template:", error);

      toast.error("Unable to download template. Please try again.");
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // Drag file over upload area
  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    if (loading) return;

    e.preventDefault();
    setIsDragging(true);
  };

  // Leave upload area
  const handleDragLeave = () => {
    if (loading) return;

    setIsDragging(false);
  };

  // Drop file
  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>
  ) => {
    if (loading) return;

    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];

    handleFileSelect(droppedFile ?? null);
  };

  return (
    <TabsContent
      value="import"
      className="mt-4 flex-1 flex flex-col gap-4"
    >
      {/* Download Template */}
      {(entityName || onDownloadTemplate) && (
        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex-1">
            <p className="text-sm font-medium">
              Download Template
            </p>

            <p className="text-xs text-muted-foreground mt-1">
              {onDownloadTemplate
                ? "Download a template to see the data format"
                : "Download Excel template to see data format"}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            aria-label="Download template"
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

      {/* User Import Instructions */}
      {entityName === "user" && (
        <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">
            How passwords work
          </p>

          <p>
            <strong>New account, Password filled:</strong> the
            password is checked (8+ characters, a letter and a
            number) and saved. The account is ready to use. No
            email is sent when an account is created.
          </p>

          <p>
            <strong>New account, Password empty:</strong> the first
            password is the letters of the email before the @
            (first letter in capital) followed by the date of birth
            as ddMMyyyy, for example Annguyen31012000. At the first
            sign-in each person must choose their own password.
            No email is sent.
          </p>

          <p>
            <strong>Existing account, Password filled:</strong>{" "}
            the password is changed and the user is signed out
            everywhere. They get a notice email (it never contains
            the password). You need the user update permission.
          </p>

          <p>
            <strong>Existing account, Password empty:</strong>{" "}
            nothing changes and no email is sent.
          </p>

          <p>
            Each email can appear only once in the file. If any
            row has an error, nothing is imported and every row
            to fix is listed by Excel row; fix them and import the
            file again. If a department in the file does not exist
            yet, you can add it from the result window.
          </p>
        </div>
      )}

      {/* Upload Area */}
      {!file && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            flex flex-col items-center justify-center flex-1
            border-2 border-dashed rounded-xl p-8 text-center gap-3
            transition-colors cursor-pointer
            ${
              isDragging
                ? "border-blue-600 bg-blue-50 dark:bg-blue-950"
                : "border-muted hover:border-primary hover:bg-accent"
            }
            ${loading ? "opacity-50 pointer-events-none" : ""}
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>

          <p className="text-sm font-medium">
            Click to upload or drag and drop
          </p>

          <p className="text-xs text-muted-foreground">
            Excel or CSV files (.xlsx, .xls, .csv) up to{" "}
            {maxFileSize / (1024 * 1024)}MB
          </p>

          <Input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            disabled={loading}
            onChange={(e) =>
              handleFileSelect(e.target.files?.[0] ?? null)
            }
          />
        </div>
      )}

      {/* Selected File */}
      {file && (
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
            <FileSpreadsheet className="h-5 w-5 text-primary flex-shrink-0" />

            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-medium truncate"
                title={file.name}
              >
                {file.name}
              </p>

              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              aria-label="Remove selected file"
              onClick={() => clearFile()}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      {/* Action Buttons */}
      {(file || onPreview) && (
        <div className="mt-auto flex gap-2">
          {onPreview && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1 font-semibold"
              disabled={!file || loading}
              onClick={handlePreviewClick}
            >
              <Eye className="mr-2 h-5 w-5" />
              Preview
            </Button>
          )}

          {!previewRequired && (
            <Button
              type="button"
              className="w-full flex-1 font-semibold disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
              onClick={handleImportClick}
              disabled={!file || loading}
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {onPreview ? "Processing..." : "Importing..."}
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-5 w-5" />
                  Import File
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </TabsContent>
  );
}
