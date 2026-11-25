
import { useRef, useState } from "react";
import { toast } from "sonner";

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

const DEFAULT_EXTENSIONS = [
  ".xlsx",
  ".xls",
  ".csv",
];

const DEFAULT_MAX_SIZE = 50 * 1024 * 1024;

interface ImportTabProps {
  loading: boolean;
  onImport: (file: File) => Promise<void>;
  entityName?: string;
  allowedExtensions?: string[];
  maxFileSizeBytes?: number;
  onDownloadTemplate?: () => Promise<void>;
}

export function ImportTab({
                            loading,
                            onImport,
                            entityName,
                            allowedExtensions = DEFAULT_EXTENSIONS,
                            maxFileSizeBytes = DEFAULT_MAX_SIZE,
                            onDownloadTemplate,
                          }: ImportTabProps) {
  const [file, setFile] = useState<File | null>(null);

  const [error, setError] = useState<string | null>(null);

  const [dragging, setDragging] = useState(false);

  const [downloading, setDownloading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const accept = allowedExtensions.join(",");

  const extensions = allowedExtensions.map((ext) =>
      ext.toLowerCase()
  );

  const maxSizeLabel =
      maxFileSizeBytes === DEFAULT_MAX_SIZE
          ? "50 MB"
          : `${Number(
              (maxFileSizeBytes / 1_000_000).toFixed(2)
          )} MB`;

  // Reset native file input.
  function resetFileInput() {
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function clearFile() {
    setFile(null);
    setError(null);
    resetFileInput();
  }

  function rejectFile(message: string) {
    setFile(null);
    setError(message);

    // Allow selecting the same file again
    // after correcting the issue.
    resetFileInput();
  }

  // =========================================
  // FILE VALIDATION
  // =========================================

  function selectFile(selected: File | null) {
    if (!selected || loading) {
      return;
    }

    const validExtension = extensions.some((ext) =>
        selected.name.toLowerCase().endsWith(ext)
    );

    if (!validExtension) {
      rejectFile(
          `Only ${allowedExtensions.join(", ")} files are allowed.`
      );
      return;
    }

    if (selected.size > maxFileSizeBytes) {
      rejectFile(
          `File size must not exceed ${maxSizeLabel}.`
      );
      return;
    }

    if (selected.size === 0) {
      rejectFile(
          "The selected file is empty."
      );
      return;
    }

    setFile(selected);
    setError(null);
  }

  // =========================================
  // IMPORT
  // =========================================

  async function handleImport() {
    if (!file || loading) {
      return;
    }

    try {
      setError(null);

      await onImport(file);

      clearFile();

    } catch (error: unknown) {
      setError(
          error instanceof Error
              ? error.message
              : "Failed to import data."
      );
    }
  }

  // =========================================
  // TEMPLATE DOWNLOAD
  // =========================================

  async function handleDownloadTemplate() {
    if (downloading || loading) {
      return;
    }

    if (!onDownloadTemplate && !entityName) {
      return;
    }

    try {
      setDownloading(true);

      if (onDownloadTemplate) {
        await onDownloadTemplate();

      } else if (entityName) {
        await downloadTemplate(entityName);
      }

      toast.success(
          "Template downloaded successfully."
      );

    } catch {
      toast.error(
          "Unable to download template."
      );

    } finally {
      setDownloading(false);
    }
  }

  return (
      <TabsContent
          value="import"
          className="mt-4 flex flex-1 flex-col gap-4"
      >
        {/* DOWNLOAD TEMPLATE */}
        {(entityName || onDownloadTemplate) && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
              <div>
                <p className="text-sm font-medium">
                  Download Template
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Download the Excel template to see the required format.
                </p>
              </div>

              <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Download import template"
                  disabled={loading || downloading}
                  onClick={() =>
                      void handleDownloadTemplate()
                  }
              >
                {downloading ? (
                    <Loader2 className="size-4 animate-spin" />
                ) : (
                    <Download className="size-4" />
                )}
              </Button>
            </div>
        )}

        {/* FILE UPLOAD */}
        {!file ? (
            <div
                role="button"
                tabIndex={loading ? -1 : 0}
                aria-label="Select an import file"
                onClick={() => {
                  if (!loading) {
                    inputRef.current?.click();
                  }
                }}
                onKeyDown={(event) => {
                  if (
                      !loading &&
                      (
                          event.key === "Enter" ||
                          event.key === " "
                      )
                  ) {
                    event.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();

                  if (!loading) {
                    setDragging(true);
                  }
                }}
                onDragLeave={() =>
                    setDragging(false)
                }
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);

                  if (!loading) {
                    selectFile(
                        event.dataTransfer.files?.[0] ?? null
                    );
                  }
                }}
                className={`flex min-h-44 flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                    dragging
                        ? "border-primary bg-accent/30"
                        : "border-muted hover:border-primary hover:bg-accent/30"
                } ${
                    loading
                        ? "pointer-events-none opacity-50"
                        : ""
                }`}
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Upload className="size-6 text-muted-foreground" />
              </div>

              <p className="text-sm font-medium">
                Click to upload or drag and drop
              </p>

              <p className="text-xs text-muted-foreground">
                {allowedExtensions.join(", ")}
                {" — max "}
                {maxSizeLabel}
              </p>

              <Input
                  ref={inputRef}
                  type="file"
                  accept={accept}
                  className="hidden"
                  disabled={loading}
                  onClick={(event) =>
                      event.stopPropagation()
                  }
                  onChange={(event) =>
                      selectFile(
                          event.target.files?.[0] ?? null
                      )
                  }
              />
            </div>
        ) : (
            /* SELECTED FILE */
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <FileSpreadsheet className="size-5 shrink-0 text-primary" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
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
                    disabled={loading}
                    aria-label="Remove selected file"
                    onClick={clearFile}
                >
                  <X className="size-4" />
                </Button>
              </div>

              <Button
                  type="button"
                  className="mt-auto w-full"
                  disabled={loading}
                  onClick={() =>
                      void handleImport()
                  }
              >
                {loading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Importing...
                    </>
                ) : (
                    <>
                      <Upload className="mr-2 size-4" />
                      Import File
                    </>
                )}
              </Button>
            </div>
        )}

        {/* ERROR MESSAGE */}
        {error && (
            <p
                role="alert"
                className="text-sm text-destructive"
            >
              {error}
            </p>
        )}
      </TabsContent>
  );
}
