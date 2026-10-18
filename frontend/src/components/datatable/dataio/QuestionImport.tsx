import { downloadQuestionTemplate } from "@/api/features/question-import.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

interface QuestionImportProps {
    table: {
        importFile?: (file: File) => Promise<any>;
    };
}

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function QuestionImport({ table }: QuestionImportProps) {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (selectedFile?: File) => {
        if (!selectedFile) return;

        if (!selectedFile.name.toLowerCase().endsWith(".csv")) {
            setError("Please select a CSV file.");
            return;
        }

        if (selectedFile.size > MAX_FILE_SIZE) {
            setError("File size must not exceed 50MB.");
            return;
        }

        setFile(selectedFile);
        setError(null);
    };

    const handleDownloadTemplate = async () => {
        try {
            setDownloading(true);
            await downloadQuestionTemplate();
            toast.success("Question template downloaded.");
        } catch {
            toast.error("Unable to download the Question template.");
        } finally {
            setDownloading(false);
        }
    };

    const handleImport = async () => {
        if (!file || !table.importFile || loading) return;

        try {
            setLoading(true);
            setError(null);

            await table.importFile(file);

            toast.success("Questions imported successfully.");
            setOpen(false);
            setFile(null);

            if (inputRef.current) {
                inputRef.current.value = "";
            }
        } catch (err: any) {
            const message =
                err?.response?.data?.message ??
                "Failed to import Questions.";

            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    // @ts-ignore
    return (
        <>
            <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(true)}
            >
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import Questions</DialogTitle>
                        <DialogDescription>
                            Upload a CSV file to import Questions.
                        </DialogDescription>
                    </DialogHeader>

                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleDownloadTemplate}
                        disabled={downloading || loading}
                    >
                        {downloading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        Download CSV Template
                    </Button>

                    <div className="flex flex-col gap-3">
                        <Input
                            ref={inputRef}
                            type="file"
                            accept=".csv,text/csv"
                            disabled={loading}
                            onChange={(event) =>
                                handleFileChange(event.target.files?.[0])
                            }
                        />

                        {file && (
                            <div className="flex items-center gap-2 text-sm">
                                <FileSpreadsheet className="h-4 w-4" />
                                <span>{file.name}</span>
                            </div>
                        )}

                        {error && (
                            <p className="text-sm text-red-600">{error}</p>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={loading}
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            disabled={!file || loading || !table.importFile}
                            onClick={handleImport}
                        >
                            {loading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            Import
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}