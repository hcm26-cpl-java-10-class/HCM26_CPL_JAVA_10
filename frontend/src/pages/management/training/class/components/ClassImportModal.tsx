import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { externalApi } from "@/api/features/external.api";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Upload, AlertCircle, CheckCircle2 } from "lucide-react";
import type { ExternalClass } from "@/types";

interface ClassImportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function ClassImportModal({ open, onOpenChange, onSuccess }: ClassImportModalProps) {
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [fileName, setFileName] = useState("");
    const [parsedData, setParsedData] = useState<Partial<ExternalClass>[]>([]);
    const [errorMsg, setErrorMsg] = useState("");
    const [isUploading, setIsUploading] = useState(false);

    const handleDownloadTemplate = () => {
        const sampleData = [
            {
                "Mã lớp (Class Code)*": "HCM26_FR_JAVA_06",
                "Tên lớp": "HCM26_FR_JAVA_06",
                "Khu vực (Site)*": "HCM",
                "Đối tượng (Trainee Type)": "Fresher",
                "Chương trình (Program)*": "FR_NFP_JAVA",
                "Quản lý lớp (Class Admin)*": "AnhVNP2, BinhHBB",
                "Sĩ số dự kiến*": 20,
                "Ngày bắt đầu (yyyy-mm-dd)*": "2026-06-01",
                "Ngày kết thúc (yyyy-mm-dd)*": "2026-12-01",
                "Giảng viên chính*": "NgaTTT45",
                "Trạng thái": "planning",
            },
            {
                "Mã lớp (Class Code)*": "HCM26_FR_REACT_01",
                "Tên lớp": "HCM26_FR_REACT_01",
                "Khu vực (Site)*": "HN",
                "Đối tượng (Trainee Type)": "Fresher",
                "Chương trình (Program)*": "FR_NFP_REACT",
                "Quản lý lớp (Class Admin)*": "NhiNLY4",
                "Sĩ số dự kiến*": 25,
                "Ngày bắt đầu (yyyy-mm-dd)*": "2026-07-01",
                "Ngày kết thúc (yyyy-mm-dd)*": "2027-01-01",
                "Giảng viên chính*": "AnhVNP2",
                "Trạng thái": "planning",
            }
        ];

        const worksheet = XLSX.utils.json_to_sheet(sampleData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Classes");
        XLSX.writeFile(workbook, "FAMS_Class_Import_Template.xlsx");
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setErrorMsg("");
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: "binary" });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const rawJson: any[] = XLSX.utils.sheet_to_json(ws);

                if (!rawJson || rawJson.length === 0) {
                    setErrorMsg("File Excel không có dữ liệu!");
                    setParsedData([]);
                    return;
                }

                // Map Excel headers to ExternalClass fields
                const mapped: Partial<ExternalClass>[] = rawJson.map((row) => ({
                    code: String(row["Mã lớp (Class Code)*"] || row["Mã lớp"] || row["Code"] || "").trim().toUpperCase(),
                    name: String(row["Tên lớp"] || row["Name"] || "").trim(),
                    site: String(row["Khu vực (Site)*"] || row["Khu vực"] || row["Site"] || "HCM").trim(),
                    traineeType: String(row["Đối tượng (Trainee Type)"] || row["Trainee Type"] || "Fresher").trim(),
                    program: String(row["Chương trình (Program)*"] || row["Program"] || "FR_NFP_JAVA").trim(),
                    classAdmin: String(row["Quản lý lớp (Class Admin)*"] || row["Class Admin"] || "Admin").trim(),
                    plannedSize: Number(row["Sĩ số dự kiến*"] || row["Planned Size"] || 20),
                    startDate: String(row["Ngày bắt đầu (yyyy-mm-dd)*"] || row["Start Date"] || "").trim(),
                    endDate: String(row["Ngày kết thúc (yyyy-mm-dd)*"] || row["End Date"] || "").trim(),
                    masterTrainer: String(row["Giảng viên chính*"] || row["Master Trainer"] || "NgaTTT45").trim(),
                    status: String(row["Trạng thái"] || row["Status"] || "planning").trim(),
                }));

                // Rule check: All rows must have code and startDate
                const invalidRow = mapped.find(r => !r.code || !r.startDate);
                if (invalidRow) {
                    setErrorMsg("Có dòng thiếu Mã lớp hoặc Ngày bắt đầu. Vui lòng kiểm tra lại file!");
                    setParsedData([]);
                    return;
                }

                setParsedData(mapped);
            } catch (err: any) {
                setErrorMsg("Không thể đọc file Excel. Vui lòng kiểm tra lại định dạng file.");
                setParsedData([]);
            }
        };
        reader.readAsBinaryString(file);
    };

    const handleImportSubmit = async () => {
        if (parsedData.length === 0) {
            setErrorMsg("Chưa có dữ liệu để import.");
            return;
        }

        setIsUploading(true);
        setErrorMsg("");
        try {
            await externalApi.batchImportClasses(parsedData);
            onSuccess();
            onOpenChange(false);
        } catch (err: any) {
            setErrorMsg(err.response?.data?.message || err.message || "Lỗi khi import lớp học.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold flex items-center gap-2">
                        <FileSpreadsheet className="size-5 text-green-600" />
                        Nhập danh sách lớp từ Excel (Import Classes)
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2 text-sm">
                    {/* Step 1: Download Template */}
                    <div className="p-3 bg-muted/40 rounded-lg flex items-center justify-between border">
                        <div>
                            <p className="font-semibold text-xs">Bước 1: Tải file Excel mẫu</p>
                            <p className="text-xs text-muted-foreground">Sử dụng định dạng chuẩn để tránh lỗi dữ liệu.</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5">
                            <Download className="size-4" /> Tải template
                        </Button>
                    </div>

                    {/* Step 2: Upload File */}
                    <div className="space-y-2">
                        <p className="font-semibold text-xs">Bước 2: Chọn file Excel (.xlsx, .xls)</p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx, .xls"
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-muted/20 transition-colors"
                        >
                            <Upload className="size-8 text-muted-foreground mx-auto mb-2" />
                            {fileName ? (
                                <p className="font-medium text-blue-800 dark:text-blue-300">{fileName}</p>
                            ) : (
                                <>
                                    <p className="font-medium text-xs">Kéo thả file vào đây hoặc bấm để chọn</p>
                                    <p className="text-[11px] text-muted-foreground mt-1">Hỗ trợ Microsoft Excel (.xlsx, .xls)</p>
                                </>
                            )}
                        </div>
                    </div>

                    {errorMsg && (
                        <div className="flex items-start gap-2 p-3 text-xs rounded-lg bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300">
                            <AlertCircle className="size-4 shrink-0 mt-0.5" />
                            <div>{errorMsg}</div>
                        </div>
                    )}

                    {parsedData.length > 0 && (
                        <div className="flex items-center gap-2 p-3 text-xs rounded-lg bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/40 dark:text-green-300">
                            <CheckCircle2 className="size-4 shrink-0" />
                            <div>Đã đọc thành công <strong>{parsedData.length}</strong> lớp học hợp lệ sẵn sàng import.</div>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUploading}>
                        Đóng
                    </Button>
                    <Button
                        onClick={handleImportSubmit}
                        disabled={parsedData.length === 0 || isUploading}
                        className="bg-blue-800 hover:bg-blue-900 text-white"
                    >
                        {isUploading ? "Đang tải lên..." : `Tiến hành Import (${parsedData.length})`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
