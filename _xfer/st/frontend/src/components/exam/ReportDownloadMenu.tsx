import axiosInstance from "@/api/axios";
import { downloadBlob, getFilenameFromHeader } from "@/components/datatable/util/dataio.utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getErrorMessage } from "@/pages/management/exam/examConfig";
import { FileDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/** "Report" dropdown that downloads an Excel or PDF file from `url?format=...`. */
export function ReportDownloadMenu({ url, fallbackName }: { url: string; fallbackName: string }) {
    const [busy, setBusy] = useState(false);

    const download = async (format: "xlsx" | "pdf") => {
        if (busy) return;
        setBusy(true);
        try {
            const response = await axiosInstance.get(url, { params: { format }, responseType: "blob" });
            const name = getFilenameFromHeader(response.headers["content-disposition"]) || `${fallbackName}.${format}`;
            downloadBlob(new Blob([response.data]), name);
            toast.success(`Report ${format.toUpperCase()} downloaded.`);
        } catch (error) {
            toast.error(getErrorMessage(error, "Could not download the report."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={busy}>
                    <FileDown className="size-4" /> {busy ? "Exporting..." : "Report"}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void download("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void download("pdf")}>PDF</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
