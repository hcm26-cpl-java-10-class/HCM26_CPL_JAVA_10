import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { fakeHttp, httpError, type RecordedCall } from "@/test/fake-http";
import { renderAt } from "@/test/render";
import { ClassImportModal } from "./ClassImportModal";
import ClassListPage from "../ClassListPage";

vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));
vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then(m => m.layoutModule()));

function excelFile(count: number, blankName = false) {
    const rows = Array.from({ length: count }, (_, i) => ({ code: `HCM26_IMPORT_${i + 1}`, name: blankName ? "" : `Import ${i + 1}`,
        program: "JAVA", status: "planning", plannedSize: 20, startDate: "2026-06-01", endDate: "2026-12-01", classAdmin: "Admin", masterTrainer: "Trainer" }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Classes");
    return new File([XLSX.write(book, { type: "array", bookType: "xlsx" })], "classes.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

beforeEach(() => fakeHttp.reset());

describe("Class import modal request and error display", () => {
    it.each([1, 6])("sends %i valid classes as a JSON array to clsApi", async count => {
        fakeHttp.on("post", "/classes/import", []);
        const success = vi.fn();
        const { user } = renderAt(<ClassImportModal open onOpenChange={vi.fn()} onSuccess={success} />, { route: "/classes" });
        await user.upload(screen.getByLabelText("Chọn file Excel"), excelFile(count));
        const button = await screen.findByRole("button", { name: `Tiến hành Import (${count})` });
        await waitFor(() => expect(button).toBeEnabled());
        await user.click(button);
        await waitFor(() => expect(success).toHaveBeenCalledOnce());
        const payload = fakeHttp.callsTo("post", "/classes/import")[0].data;
        expect(Array.isArray(payload)).toBe(true);
        expect(payload).toHaveLength(count);
        expect(payload).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Import 1", status: "planning", startDate: "2026-06-01", plannedSize: 20 })]));
    });

    it("shows backend row and field details instead of only Validation failed", async () => {
        fakeHttp.on("post", "/classes/import", () => { throw httpError(400, { message: "Validation failed", errors: { "[1].code": ["Class code already exists"] } }); });
        const success = vi.fn();
        const { user } = renderAt(<ClassImportModal open onOpenChange={vi.fn()} onSuccess={success} />, { route: "/classes" });
        await user.upload(screen.getByLabelText("Chọn file Excel"), excelFile(6));
        await user.click(await screen.findByRole("button", { name: "Tiến hành Import (6)" }));
        expect(await screen.findByText(/Dòng 3.*Class code already exists/)).toHaveTextContent("code");
        expect(success).not.toHaveBeenCalled();
    });

    it("blocks a missing required name and identifies its Excel row", async () => {
        const { user } = renderAt(<ClassImportModal open onOpenChange={vi.fn()} onSuccess={vi.fn()} />, { route: "/classes" });
        await user.upload(screen.getByLabelText("Chọn file Excel"), excelFile(1, true));
        expect(await screen.findByRole("alert")).toHaveTextContent("Dòng 2 — name: Trường bắt buộc.");
        expect(screen.getByRole("button", { name: "Tiến hành Import (1)" })).toBeDisabled();
        expect(fakeHttp.callsTo("post", "/classes/import")).toHaveLength(0);
    });

    it("refetches Class List and displays the six imported classes", async () => {
        let saved: unknown[] = [];
        fakeHttp.on("get", "/classes", () => ({ content: saved, totalElements: saved.length }));
        fakeHttp.on("post", "/classes/import", (call: RecordedCall) => {
            saved = (call.data as Record<string, unknown>[]).map((item, i) => ({ ...item, id: i + 1 }));
            return saved;
        });
        const { user } = renderAt(<ClassListPage />, { route: "/classes" });
        await screen.findByText("The master training system has no classes yet.");
        await user.click(screen.getByRole("button", { name: /^import$/i }));
        await user.upload(screen.getByLabelText("Chọn file Excel"), excelFile(6));
        await user.click(await screen.findByRole("button", { name: "Tiến hành Import (6)" }));
        const table = await screen.findByRole("table", { name: "Classes" });
        expect(within(table).getAllByRole("row")).toHaveLength(7);
        expect(screen.getByRole("link", { name: "HCM26_IMPORT_6" })).toBeInTheDocument();
        expect(fakeHttp.callsTo("get", "/classes")).toHaveLength(2);
    });

    it("keeps imported classes discoverable beyond the first backend page", async () => {
        const firstPage = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, code: `AAA_${i + 1}`, name: `Existing ${i + 1}`, status: "planning" }));
        let saved: unknown[] = [];
        fakeHttp.on("get", "/classes", (call: RecordedCall) => {
            const page = (call.params as { page?: number })?.page ?? 0;
            return { content: page === 0 ? firstPage : saved, totalPages: saved.length ? 2 : 1, size: 100, totalElements: 100 + saved.length };
        });
        fakeHttp.on("post", "/classes/import", (call: RecordedCall) => {
            saved = (call.data as Record<string, unknown>[]).map((item, i) => ({ ...item, id: 101 + i }));
            return saved;
        });
        const { user } = renderAt(<ClassListPage />, { route: "/classes" });
        await screen.findByRole("table", { name: "Classes" });
        await user.click(screen.getByRole("button", { name: /^import$/i }));
        await user.upload(screen.getByLabelText("Chọn file Excel"), excelFile(6));
        await user.click(await screen.findByRole("button", { name: "Tiến hành Import (6)" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        await user.type(screen.getByRole("textbox", { name: "Search classes" }), "HCM26_IMPORT_6");
        expect(await screen.findByRole("link", { name: "HCM26_IMPORT_6" })).toBeInTheDocument();
        expect(fakeHttp.callsTo("get", "/classes").some(call => (call.params as { page?: number }).page === 1)).toBe(true);
    });
});
