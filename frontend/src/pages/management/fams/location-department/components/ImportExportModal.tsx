import React, { useState } from "react";
import { Download, Upload, FileText, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DepartmentItem } from "../types";

interface ImportExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: DepartmentItem[];
  onImportDepartments: (newDepts: DepartmentItem[]) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  open,
  onOpenChange,
  departments,
  onImportDepartments,
}) => {
  const [activeTab, setActiveTab] = useState<string>("import");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [exportFormat, setExportFormat] = useState<"xlsx" | "csv">("xlsx");
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImportSubmit = () => {
    if (!selectedFile) {
      toast.error("Please choose a CSV or Excel file to import.");
      return;
    }

    setIsProcessing(true);
    setTimeout(() => {
      // Mock import sample data
      const importedMock: DepartmentItem[] = [
        {
          id: `dept-imp-${Date.now()}-1`,
          code: "SEC-OPS",
          name: "Security Operations Center",
          locationId: "loc-hn-hl",
          locationName: "Hòa Lạc",
          linkedEntities: "15 users",
          status: "Active",
          description: "24/7 SOC monitoring and threat mitigation",
        },
        {
          id: `dept-imp-${Date.now()}-2`,
          code: "AUTOMATION",
          name: "RPA & Automation Practice",
          locationId: "loc-hcm-ft1",
          locationName: "F-Town 1 & 2",
          linkedEntities: "28 users",
          status: "Active",
          description: "Robotic process automation workflows and bots",
        },
      ];

      onImportDepartments(importedMock);
      setIsProcessing(false);
      setSelectedFile(null);
      toast.success(
        `Imported ${importedMock.length} departments successfully from ${selectedFile.name}!`
      );
      onOpenChange(false);
    }, 800);
  };

  const handleExportSubmit = () => {
    setIsProcessing(true);
    setTimeout(() => {
      // Generate CSV text
      const headers = ["ID", "Code", "Name", "Location", "Linked Entities", "Status", "Description"];
      const rows = departments.map((d) => [
        `"${d.id}"`,
        `"${d.code}"`,
        `"${d.name}"`,
        `"${d.locationName}"`,
        `"${d.linkedEntities}"`,
        `"${d.status}"`,
        `"${d.description || ""}"`,
      ]);

      const csvContent =
        "data:text/csv;charset=utf-8," +
        [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute(
        "download",
        `departments_export_${new Date().toISOString().slice(0, 10)}.${exportFormat === "xlsx" ? "csv" : "csv"}`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsProcessing(false);
      toast.success(`Exported ${departments.length} departments to ${exportFormat.toUpperCase()}!`);
      onOpenChange(false);
    }, 600);
  };

  const handleDownloadTemplate = () => {
    const templateContent =
      "data:text/csv;charset=utf-8,Code,Name,Location,Linked Entities,Status,Description\nIT-SAMPLE,Sample Engineering,Hòa Lạc,10 users,Active,Sample department template";
    const encodedUri = encodeURI(templateContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "department_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.info("Import template downloaded.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-6 bg-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-gray-900">
            Import / Export Data
          </DialogTitle>
          <p className="text-xs text-gray-500">
            Transfer location and department records via Excel or CSV.
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2 w-full">
          <TabsList className="grid w-full grid-cols-2 bg-gray-100 p-1 rounded-lg">
            <TabsTrigger
              value="import"
              className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs text-sm font-medium"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
            </TabsTrigger>
            <TabsTrigger
              value="export"
              className="data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-xs text-sm font-medium"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </TabsTrigger>
          </TabsList>

          {/* Import Tab */}
          <TabsContent value="import" className="space-y-4 pt-4">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-blue-400 transition-colors bg-gray-50/50">
              <FileSpreadsheet className="h-10 w-10 text-blue-600 mb-2" />
              <p className="text-sm font-medium text-gray-900">
                Drag and drop your file here, or browse
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Supports .xlsx, .xls, .csv files up to 10MB
              </p>

              <label className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-medium cursor-pointer transition-colors">
                <Upload className="h-4 w-4" />
                <span>Browse File</span>
                <input
                  type="file"
                  accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              {selectedFile && (
                <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-md border border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span className="font-medium truncate max-w-[280px]">
                    {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
              <span>Need the standard columns layout?</span>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="text-blue-600 hover:text-blue-700 font-medium underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Download className="h-3 w-3" />
                Download Template
              </button>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedFile || isProcessing}
                onClick={handleImportSubmit}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isProcessing ? "Importing..." : "Start Import"}
              </button>
            </div>
          </TabsContent>

          {/* Export Tab */}
          <TabsContent value="export" className="space-y-4 pt-4">
            <div className="space-y-3">
              <label className="text-xs font-semibold text-gray-700">
                Export File Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExportFormat("xlsx")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setExportFormat("xlsx");
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-sm cursor-pointer transition-all ${
                    exportFormat === "xlsx"
                      ? "border-blue-600 bg-blue-50/60 text-blue-900 font-medium shadow-xs"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                  <div>
                    <div className="font-semibold">Microsoft Excel</div>
                    <div className="text-xs text-gray-500">.xlsx format</div>
                  </div>
                </div>

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExportFormat("csv")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setExportFormat("csv");
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-sm cursor-pointer transition-all ${
                    exportFormat === "csv"
                      ? "border-blue-600 bg-blue-50/60 text-blue-900 font-medium shadow-xs"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  }`}
                >
                  <FileText className="h-5 w-5 text-blue-600" />
                  <div>
                    <div className="font-semibold">CSV Text</div>
                    <div className="text-xs text-gray-500">.csv format</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg text-xs text-gray-600 space-y-1">
              <div className="font-semibold text-gray-800">Export Summary:</div>
              <div>• {departments.length} departments will be exported.</div>
              <div>• Includes codes, titles, locations, and linked entity metrics.</div>
            </div>

            <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleExportSubmit}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium text-white shadow-xs transition-colors cursor-pointer flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                <span>{isProcessing ? "Exporting..." : "Download Export"}</span>
              </button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
