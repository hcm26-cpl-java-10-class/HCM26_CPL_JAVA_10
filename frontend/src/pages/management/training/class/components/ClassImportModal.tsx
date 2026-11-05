import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { clsApi, type CreateTrainingClassInput } from "@/api/features/cls.api";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import { describeApiError } from "@/utils/api-error.utils";
import { parseClassWorkbook, classImportServerIssues, type ClassImportIssue } from "@/utils/class-import.utils";

interface ClassImportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function ClassImportModal({ open, onOpenChange, onSuccess }: ClassImportModalProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [fileName, setFileName] = useState("");
    const [parsedData, setParsedData] = useState<CreateTrainingClassInput[]>([]);
    const [rowNumbers, setRowNumbers] = useState<number[]>([]);
    const [issues, setIssues] = useState<ClassImportIssue[]>([]);
    const [errorMsg, setErrorMsg] = useState("");
    const [isUploading, setIsUploading] = useState(false);

    const reset = () => {
        setFileName("");
        setParsedData([]);
        setRowNumbers([]);
        setIssues([]);
        setErrorMsg("");
    };
    const close = () => { reset(); onOpenChange(false); };

    const handleDownloadTemplate = () => {
        const worksheet = XLSX.utils.aoa_to_sheet([[
            "Mã lớp (Class Code)*", "Tên lớp*", "Khu vực (Site)", "Đối tượng (Trainee Type)",
            "Chương trình (Program)*", "Quản lý lớp (Class Admin)*", "Sĩ số dự kiến*",
            "Ngày bắt đầu (yyyy-mm-dd)*", "Ngày kết thúc (yyyy-mm-dd)*", "Giảng viên chính*", "Trạng thái*",
        ]]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Classes");
        XLSX.writeFile(workbook, "FAMS_Class_Import_Template.xlsx");
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        reset();
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const result = parseClassWorkbook(XLSX.read(evt.target?.result, { type: "array" }));
                setParsedData(result.data);
                setRowNumbers(result.rowNumbers);
                setIssues(result.errors);
            } catch {
                setErrorMsg("Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.");
            }
        };
        reader.onerror = () => setErrorMsg("Không thể đọc file Excel.");
        reader.readAsArrayBuffer(file);
    };

    const handleImportSubmit = async () => {
        if (parsedData.length === 0 || issues.length > 0) return;
        setIsUploading(true);
        setErrorMsg("");
        try {
            await clsApi.importClasses(parsedData);
            onSuccess();
            close();
        } catch (err: unknown) {
            const error = describeApiError(err, "Lỗi khi import lớp học.");
            setErrorMsg(error.message);
            setIssues(classImportServerIssues(error.fieldErrors, rowNumbers));
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => { if (!isUploading) { reset(); onOpenChange(nextOpen); } }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <FileSpreadsheet className="size-5 text-green-600" /> Nhập danh sách lớp từ Excel (Import Classes)
                    </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2 text-sm">
                    <div className="p-3 bg-muted/40 rounded-lg flex items-center justify-between border">
                        <div>
                            <p className="font-semibold text-xs">Bước 1: Tải file Excel mẫu</p>
                            <p className="text-xs text-muted-foreground">Điền đầy đủ các cột có dấu *.</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5">
                            <Download className="size-4" /> Tải template
                        </Button>
                    </div>
                    <div className="space-y-2">
                        <p className="font-semibold text-xs">Bước 2: Chọn file Excel (.xlsx, .xls)</p>
                        <input ref={fileInputRef} aria-label="Chọn file Excel" type="file" accept=".xlsx, .xls" className="hidden" onChange={handleFileChange} disabled={isUploading} />
                        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="h-auto w-full border-2 border-dashed p-6">
                            <Upload className="size-5" /> {fileName || "Bấm để chọn file Excel"}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Tên lớp là bắt buộc; trạng thái lớp mới phải là planning. Ngày dùng YYYY-MM-DD hoặc ô ngày Excel. Sĩ số là số nguyên từ 1 đến 50.</p>
                    {errorMsg && (
                        <div role="alert" className="flex items-start gap-2 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                            <AlertCircle className="size-4 shrink-0" /><div>{errorMsg}</div>
                        </div>
                    )}
                    {issues.length > 0 && (
                        <ul role="alert" className="max-h-60 overflow-auto space-y-1 rounded border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                            {issues.map((issue, index) => (
                                <li key={index}>{issue.row ? `Dòng ${issue.row} — ` : ""}<strong>{issue.field}</strong>: {issue.message}</li>
                            ))}
                        </ul>
                    )}
                    {parsedData.length > 0 && issues.length === 0 && (
                        <div className="flex items-center gap-2 rounded border border-green-200 bg-green-50 p-3 text-xs text-green-700">
                            <CheckCircle2 className="size-4 shrink-0" />
                            <div>Đã đọc <strong>{parsedData.length}</strong> lớp học đáp ứng kiểm tra file. Backend sẽ kiểm tra mã trùng trước khi lưu.</div>
                        </div>
                    )}
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={close} disabled={isUploading}>Đóng</Button>
                    <Button onClick={handleImportSubmit} disabled={parsedData.length === 0 || issues.length > 0 || isUploading} className="bg-blue-800 hover:bg-blue-900 text-white">
                        {isUploading ? "Đang tải lên..." : `Tiến hành Import (${parsedData.length})`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
