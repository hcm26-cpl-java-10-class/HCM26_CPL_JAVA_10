import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { ModuleItem } from "../types";

interface ImportExportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    modules: ModuleItem[];
    onImportModules: (newModules: ModuleItem[]) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
    open,
    onOpenChange,
    modules,
    onImportModules,
}) => {
    const [isExporting, setIsExporting] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);

    const handleExport = () => {
        setIsExporting(true);
        setTimeout(() => {
            // Generate simple CSV content for download
            const headers = ["ID", "Mã", "Tên", "URL", "Liên kết", "Trạng thái"];
            const rows = modules.map((m) => [
                m.id,
                `"${m.code}"`,
                `"${m.name}"`,
                `"${m.url}"`,
                `"${m.linkInfo}"`,
                m.status,
            ]);

            const csvContent =
                "data:text/csv;charset=utf-8," +
                [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `fams_modules_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setIsExporting(false);
            toast.success("Xuất dữ liệu thành công!");
            onOpenChange(false);
        }, 600);
    };

    const handleImport = () => {
        if (!uploadedFile) {
            toast.error("Vui lòng chọn file dữ liệu để import");
            return;
        }

        // Simulate reading file and adding sample module
        const mockImportedModule: ModuleItem = {
            id: `mod-imported-${Date.now()}`,
            groupId: modules[0]?.groupId || "group-training",
            code: "IMPORT-NEW",
            name: "Imported New Module",
            url: "Training Center",
            linkInfo: "25 users",
            status: "Active",
            displayOrder: 99,
        };

        onImportModules([mockImportedModule]);
        toast.success(`Đã import thành công dữ liệu từ ${uploadedFile.name}`);
        setUploadedFile(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        Import / Export Dữ liệu
                    </DialogTitle>
                    <DialogDescription className="text-sm text-gray-500">
                        Nhập hoặc xuất danh sách Module theo định dạng bảng tính CSV/Excel.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Export section */}
                    <div className="rounded-lg border border-gray-200 p-4 bg-gray-50/50 dark:bg-gray-900/50">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                                <Download className="h-5 w-5" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    Xuất dữ liệu Modules
                                </h4>
                                <p className="text-xs text-gray-500">
                                    Xuất {modules.length} modules hiện có thành file CSV
                                </p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleExport}
                                disabled={isExporting}
                                className="cursor-pointer border-gray-300 hover:bg-white text-gray-700"
                            >
                                <FileSpreadsheet className="h-4 w-4 mr-1.5 text-green-600" />
                                {isExporting ? "Đang xuất..." : "Xuất CSV"}
                            </Button>
                        </div>
                    </div>

                    {/* Import section */}
                    <div className="rounded-lg border border-gray-200 p-4 bg-gray-50/50 dark:bg-gray-900/50">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                                <Upload className="h-5 w-5" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    Nhập dữ liệu Modules
                                </h4>
                                <p className="text-xs text-gray-500">
                                    Chọn file CSV hoặc Excel từ máy tính của bạn
                                </p>
                            </div>
                        </div>

                        <div className="mt-2">
                            <input
                                id="file-upload"
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setUploadedFile(e.target.files[0]);
                                    }
                                }}
                                className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 cursor-pointer"
                            />
                            {uploadedFile && (
                                <p className="mt-2 text-xs text-green-600 flex items-center gap-1 font-medium">
                                    <CheckCircle2 className="h-3.5 w-3.5" /> Đã chọn file: {uploadedFile.name}
                                </p>
                            )}
                        </div>

                        <div className="mt-4 flex justify-end">
                            <Button
                                type="button"
                                onClick={handleImport}
                                disabled={!uploadedFile}
                                className="bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                            >
                                Tiến hành Import
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        className="cursor-pointer"
                    >
                        Đóng
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
