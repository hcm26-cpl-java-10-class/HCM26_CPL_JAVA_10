
import { downloadTemplate } from "@/api/features/dataio/dataio-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TabsContent } from "@/components/ui/tabs";
import {
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

const DEFAULT_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const DEFAULT_MAX_FILE_SIZE = 50 * 1024 * 1024;

interface ImportTabProps {
  loading: boolean;
  onImport: (file: File) => Promise<void>;
  entityName?: string;

  // Optional settings for different modules.
  allowedExtensions?: string[];
  maxFileSizeBytes?: number;
}

export function ImportTab({
                            loading,
                            onImport,
                            entityName,
                            allowedExtensions = DEFAULT_EXTENSIONS,
                            maxFileSizeBytes = DEFAULT_MAX_FILE_SIZE,
                          }: ImportTabProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] =
      useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const extensions = allowedExtensions.map((ext) =>
      ext.toLowerCase()
  );

  const displayExtensions = allowedExtensions.join(", ");

  const maxSizeLabel =
      maxFileSizeBytes === DEFAULT_MAX_FILE_SIZE
          ? "50 MB"
          : `${Number(
              (maxFileSizeBytes / 1_000_000).toFixed(2)
          )} MB`;

  const clearFile = () => {
    setFile(null);
    setError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (selected: File | null) => {
    if (!selected || loading) return;

    const validExtension = extensions.some((extension) =>
        selected.name.toLowerCase().endsWith(extension)
    );

    if (!validExtension) {
      setFile(null);
      setError(
          `Only ${displayExtensions} files are allowed.`
      );
      return;
    }

    if (selected.size > maxFileSizeBytes) {
      setFile(null);
      setError(
          `File size must not exceed ${maxSizeLabel}.`
      );
      return;
    }

    setFile(selected);
    setError(null);
  };

  const handleImportClick = async () => {
    if (!file || loading) return;

    try {
      setError(null);
      await onImport(file);
      clearFile();
    } catch (err: unknown) {
      const message =
          err instanceof Error
              ? err.message
              : "Failed to import data";

      setError(message);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!entityName) return;

    try {
      setDownloadingTemplate(true);

      await downloadTemplate(entityName);

      toast.success(
          "Template downloaded successfully"
      );
    } catch (error) {
      console.error(
          "Error downloading template:",
          error
      );

      toast.error(
          "Unable to download template. Please try again."
      );
    } finally {
      setDownloadingTemplate(false);
    }
  };

  return (
      <TabsContent
          value="import"
          className="mt-4 flex flex-1 flex-col gap-4"
      >
        {/* DOWNLOAD TEMPLATE */}
        {entityName && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Download Template
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Download Excel template to see data format
                </p>
              </div>

              <Button
                  type="button"
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

        {/* FILE UPLOAD AREA */}
        {!file ? (
            <div
                onDragOver={(event) => {
                  if (loading) return;

                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => {
                  if (!loading) setIsDragging(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();

                  if (loading) return;

                  setIsDragging(false);

                  handleFileSelect(
                      event.dataTransfer.files?.[0] ?? null
                  );
                }}
                className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                    isDragging
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950"
                        : "border-muted hover:border-primary hover:bg-accent"
                } ${
                    loading
                        ? "pointer-events-none opacity-50"
                        : ""
                }`}
                onClick={() =>
                    fileInputRef.current?.click()
                }
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>

              <p className="text-sm font-medium">
                Click to upload or drag and drop
              </p>

              <p className="text-xs text-muted-foreground">
                {displayExtensions} — max {maxSizeLabel}
              </p>

              <Input
                  ref={fileInputRef}
                  type="file"
                  accept={allowedExtensions.join(",")}
                  className="hidden"
                  disabled={loading}
                  onChange={(event) =>
                      handleFileSelect(
                          event.target.files?.[0] ?? null
                      )
                  }
              />
            </div>
        ) : (
            /* SELECTED FILE */
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <FileSpreadsheet className="h-5 w-5 shrink-0 text-primary" />

                <div className="min-w-0 flex-1">
                  <p
                      className="truncate text-sm font-medium"
                      title={file.name}
                  >
                    {file.name}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearFile}
                    disabled={loading}
                    className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <Button
                  type="button"
                  className="mt-auto w-full"
                  onClick={handleImportClick}
                  disabled={loading}
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

        {/* VALIDATION / API ERROR */}
        {error && (
            <p
                role="alert"
                className="text-sm text-red-600"
            >
              {error}
            </p>
        )}
      </TabsContent>
  );
}
