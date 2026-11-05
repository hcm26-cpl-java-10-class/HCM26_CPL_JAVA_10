
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";

import api from "@/api/axios";

import {
    downloadBlob,
    getFilenameFromHeader,
} from "@/components/datatable/util/dataio.utils";

import ActionButton from "@/components/datatable/common/ActionButton";
import { ImportModal } from "@/components/datatable/dataio/ImportModal";
import { ImportResultModal } from "@/components/datatable/dataio/ImportResultModal";

import type { ImportResult } from "@/types";

import {
    syllabusApi,
    type SyllabusImportSummary,
} from "@/api/features/demo/syllabus.api";

const MAX_FILE_SIZE = 5_000_000;

// Download the M3 five-sheet template.
async function downloadSyllabusTemplate(): Promise<void> {
    const response = await api.get(
        "/syllabuses/import/template",
        {
            responseType: "blob",
        }
    );

    const filename =
        getFilenameFromHeader(
            response.headers["content-disposition"]
        ) || "syllabuses-template.xlsx";

    downloadBlob(response.data as Blob, filename);
}

export function SyllabusImportAction() {
    const queryClient = useQueryClient();

    const [importOpen, setImportOpen] = useState(false);
    const [resultOpen, setResultOpen] = useState(false);

    const [importResult, setImportResult] =
        useState<ImportResult | null>(null);

    // Store the latest successful import summary.
    const lastSummary =
        useRef<SyllabusImportSummary | null>(null);

    async function importFile(
        file: File
    ): Promise<ImportResult> {
        // Validate file format.
        if (!file.name.toLowerCase().endsWith(".xlsx")) {
            throw new Error(
                "Syllabus import requires an .xlsx file."
            );
        }

        // Validate file size.
        if (
            file.size === 0 ||
            file.size > MAX_FILE_SIZE
        ) {
            throw new Error(
                "File must not be empty or exceed 5 MB."
            );
        }

        lastSummary.current = null;

        // Backend decides whether import succeeds.
        // It also protects Published syllabuses.
        const summary = await syllabusApi.importExcel(file);

        lastSummary.current = summary;

        // Refresh catalogs independently.
        // Refetching must not change the import result.
        void queryClient.invalidateQueries({
            queryKey: ["syllabuses"],
        });

        void queryClient.invalidateQueries({
            queryKey: ["student-syllabuses"],
        });

        const totalImported =
            summary.syllabuses +
            summary.clos +
            summary.sections +
            summary.topics +
            summary.materials;

        // Adapt M3 summary to the shared Base ImportResult.
        return {
            successCount: totalImported,
            failureCount: 0,
            errors: [],
        };
    }

    function handleImportSuccess(result: ImportResult) {
        setImportResult(result);
        setResultOpen(true);

        const summary = lastSummary.current;

        if (summary) {
            toast.info("Imported records by sheet", {
                description:
                    `Syllabuses: ${summary.syllabuses} · ` +
                    `CLOs: ${summary.clos} · ` +
                    `Sections: ${summary.sections} · ` +
                    `Topics: ${summary.topics} · ` +
                    `Materials: ${summary.materials}`,
            });
        }
    }

    return (
        <>
            {/* Reuse the shared Base action button. */}
            <ActionButton
                title="Import"
                tooltip="Import Syllabuses using the shared LMS importer"
                variant="secondary"
                icon={<Upload size={16} />}
                onClick={() => setImportOpen(true)}
            />

            {/* Reuse the shared Base import modal. */}
            <ImportModal
                open={importOpen}
                onOpenChange={setImportOpen}
                table={{
                    schema: {
                        entityName: "syllabus",
                    },
                    importFile,
                }}
                title="Import Syllabuses"
                description="Download the five-sheet template, complete the data and upload an .xlsx file up to 5 MB. Demo import accepts DEMO-* codes and does not overwrite Published syllabuses."
                canImport
                allowedExtensions={[".xlsx"]}
                maxFileSizeBytes={MAX_FILE_SIZE}
                onDownloadTemplate={downloadSyllabusTemplate}
                onImportSuccess={handleImportSuccess}
            />

            {/* Reuse the shared Base import result modal. */}
            <ImportResultModal
                open={resultOpen}
                onOpenChange={setResultOpen}
                result={importResult}
                onBackToImport={() => {
                    setResultOpen(false);
                    setImportOpen(true);
                }}
            />
        </>
    );
}
