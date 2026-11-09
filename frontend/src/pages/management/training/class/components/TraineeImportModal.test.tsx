import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { fakeHttp, httpError, type RecordedCall } from "@/test/fake-http";
import { renderAt } from "@/test/render";
import { grant } from "@/test/mocks";
import { TRAINEE_IMPORT_HEADERS, parseTraineeWorkbook } from "@/utils/trainee-import.utils";
import { TraineeImportModal } from "./TraineeImportModal";
import { TraineeListTab } from "./TraineeListTab";
import type { Trainee } from "@/types";

vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then(m => m.permissionsModule()));
vi.mock("xlsx", async importOriginal => ({ ...await importOriginal<typeof import("xlsx")>(), writeFile: vi.fn() }));

const preview = { totalRows: 1, validRows: 1, invalidRows: 0, duplicateRows: 0, canImport: true,
    rows: [{ rowNumber: 2, valid: true, duplicate: false, errors: {} }] };
function file(values: unknown[] = ["SE999001", "Test Student One", "test1@gmail.com", "23/08/2004", "Male"]) {
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([TRAINEE_IMPORT_HEADERS, values]), "Trainees");
    return new File([XLSX.write(book, { type: "array", bookType: "xlsx" })], "trainees.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
beforeEach(() => {
    fakeHttp.reset(); vi.clearAllMocks(); grant("CLASS_READ", "ENROLLMENT_READ", "ENROLLMENT_CREATE", "ENROLLMENT_UPDATE", "ENROLLMENT_DELETE");
    fakeHttp.on("post", "/classes/12/trainees/preview", preview);
    fakeHttp.on("post", "/classes/12/trainees/import", { importedCount: 1, enrolledTrainees: 1 });
});
describe("Trainee Excel preview, smart validation, and confirmation", () => {
    it("parses flexible date strings (DD/MM/YYYY, YYYY-MM-DD, DD-MMM-YYYY), trims text/numbers, and ignores legacy National ID column", () => {
        const book = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([
            ["Student ID*", "Full Name*", "Personal Email", "National ID", "DOB", "Gender"],
            ["  se180101 ", "  Hoàng   Phương Bình  ", " phuongbinh@gmail.com ", 75204005839, "23/08/2004", "male"],
            ["SS180102", "Trần Việt Anh", "anhviet@gmail.com", "", "2004-01-28", "FEMALE"],
            ["AI180103", "Trần Vũ Gia Bảo", "baohse@gmail.com", "", "23-Sep-2003", "Nam"],
        ]), "Trainees");
        const parsed = parseTraineeWorkbook(book);
        expect(parsed.issues).toEqual([]);
        expect(parsed.rows).toEqual([
            { rowNumber: 2, studentId: "SE180101", fullName: "Hoàng Phương Bình", personalEmail: "phuongbinh@gmail.com", dob: "2004-08-23", gender: "Male" },
            { rowNumber: 3, studentId: "SS180102", fullName: "Trần Việt Anh", personalEmail: "anhviet@gmail.com", dob: "2004-01-28", gender: "Female" },
            { rowNumber: 4, studentId: "AI180103", fullName: "Trần Vũ Gia Bảo", personalEmail: "baohse@gmail.com", dob: "2003-09-23", gender: "Male" },
        ]);
    });
    it("downloads the template, sends nothing on file selection, previews without saving, and imports only after Confirm", async () => {
        const close = vi.fn();
        const { user } = renderAt(<TraineeImportModal open classId={12} onOpenChange={close} />, { route: "/classes/12" });
        await user.click(screen.getByRole("button", { name: "Download Template" }));
        expect(XLSX.writeFile).toHaveBeenCalledOnce();
        await user.upload(screen.getByLabelText(/Select Excel file/), file());
        expect(fakeHttp.calls).toHaveLength(0);
        expect(screen.getByRole("button", { name: /Confirm Import/ })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: /Preview & Validate/ }));
        expect(await screen.findByRole("table", { name: "Trainee import preview" })).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole("button", { name: /Confirm Import/ })).toBeEnabled());
        expect(fakeHttp.callsTo("post", "/classes/12/trainees/import")).toHaveLength(0);
        await user.click(screen.getByRole("button", { name: /Confirm Import/ }));
        await waitFor(() => expect(close).toHaveBeenCalledWith(false));
        expect(fakeHttp.callsTo("post", "/classes/12/trainees/import")[0].data).toEqual([expect.objectContaining({ rowNumber: 2, studentId: "SE999001", fullName: "Test Student One", dob: "2004-08-23" })]);
    });
    it("shows server row-level errors and never allows Confirm on invalid preview", async () => {
        fakeHttp.on("post", "/classes/12/trainees/preview", { ...preview, validRows: 0, invalidRows: 1, canImport: false,
            rows: [{ rowNumber: 2, valid: false, duplicate: true, errors: { studentId: ["Already enrolled in this class"] } }] });
        const { user } = renderAt(<TraineeImportModal open classId={12} onOpenChange={vi.fn()} />, { route: "/classes/12" });
        await user.upload(screen.getByLabelText(/Select Excel file/), file());
        await user.click(screen.getByRole("button", { name: /Preview & Validate/ }));
        expect(await screen.findByText(/studentId: Already enrolled/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Confirm Import/ })).toBeDisabled();
        expect(fakeHttp.callsTo("post", "/classes/12/trainees/import")).toHaveLength(0);
    });
    it("rejects malformed workbook and invalid rows locally without any upload", async () => {
        const { user } = renderAt(<TraineeImportModal open classId={12} onOpenChange={vi.fn()} />, { route: "/classes/12" });
        await user.upload(screen.getByLabelText(/Select Excel file/), new File(["broken"], "broken.xlsx"));
        await user.click(screen.getByRole("button", { name: /Preview & Validate/ }));
        expect(await screen.findByRole("alert")).toHaveTextContent("not a valid XLSX");
        await user.upload(screen.getByLabelText(/Select Excel file/), file(["", "", "bad-email"]));
        await user.click(screen.getByRole("button", { name: /Preview & Validate/ }));
        expect(await screen.findByText(/studentId: Student ID is required/)).toBeInTheDocument();
        expect(fakeHttp.calls).toHaveLength(0);
    });
    it("requires a new preview after stale capacity is rejected at Confirm", async () => {
        fakeHttp.on("post", "/classes/12/trainees/import", () => { throw httpError(400, { message: "Validation failed", errors: { "rows[2].capacity": ["Class capacity changed"] } }); });
        const { user } = renderAt(<TraineeImportModal open classId={12} onOpenChange={vi.fn()} />, { route: "/classes/12" });
        await user.upload(screen.getByLabelText(/Select Excel file/), file()); await user.click(screen.getByRole("button", { name: /Preview & Validate/ }));
        await waitFor(() => expect(screen.getByRole("button", { name: /Confirm Import/ })).toBeEnabled());
        await user.click(screen.getByRole("button", { name: /Confirm Import/ }));
        expect(await screen.findByText(/capacity: Class capacity changed/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Confirm Import/ })).toBeDisabled();
    });
    it("refreshes the real trainee list and readiness after successful import, preserving canonical identity", async () => {
        let trainees: Trainee[] = [];
        fakeHttp.on("get", "/classes/12/trainees", () => trainees);
        fakeHttp.on("post", "/classes/12/trainees/import", () => {
            trainees = [{ id: 101, fptAccount: "SE999001", fullName: "Test Student One", status: "Active" }];
            return { importedCount: 1, enrolledTrainees: 1 };
        });
        const { user, client } = renderAt(<TraineeListTab classItem={{ id: 12, traineeSource: "internal", site: "HN" }} />, { route: "/classes/12" });
        const invalidate = vi.spyOn(client, "invalidateQueries");
        await screen.findByText("No trainees enrolled in this class yet.");
        await user.click(screen.getByRole("button", { name: "Import Excel" }));
        await user.upload(screen.getByLabelText(/Select Excel file/), file()); await user.click(screen.getByRole("button", { name: /Preview & Validate/ }));
        await waitFor(() => expect(screen.getByRole("button", { name: /Confirm Import/ })).toBeEnabled());
        await user.click(screen.getByRole("button", { name: /Confirm Import/ }));
        const table = screen.getByRole("table", { name: "Trainee List" });
        expect(await within(table).findByText("SE999001")).toBeInTheDocument();
        expect(within(table).queryByText("HE999001")).not.toBeInTheDocument();
        expect(invalidate).toHaveBeenCalledWith({ queryKey: ["classes", "readiness", "12"] });
        expect(fakeHttp.callsTo("get", "/external/classes/12/trainees")).toHaveLength(0);
    });
    it("blocks profiles and import without enrollment permissions", () => {
        grant("CLASS_READ");
        renderAt(<TraineeListTab classItem={{ id: 12, traineeSource: "internal" }} />, { route: "/classes/12" });
        expect(screen.getByRole("alert")).toHaveTextContent("do not have permission");
        expect(fakeHttp.calls).toHaveLength(0);
    });
    it("stages existing identities and saves through the internal batch API", async () => {
        let trainees: Trainee[] = [];
        fakeHttp.on("get", "/classes/12/trainees", () => trainees);
        fakeHttp.on("put", "/classes/12/trainees/batch", (call: RecordedCall) => {
            expect(call.data).toEqual({ created: [{ rowNumber: 2, studentId: "EXISTING_01", fullName: "Existing Student" }], updated: [], deletedIds: [] });
            trainees = [{ id: 101, fptAccount: "EXISTING_01", fullName: "Existing Student", status: "Active" }];
            return { message: "Saved", trainees };
        });
        const { user } = renderAt(<TraineeListTab classItem={{ id: 12, traineeSource: "internal" }} />, { route: "/classes/12" });
        await screen.findByText("No trainees enrolled in this class yet.");
        await user.click(screen.getByRole("button", { name: "+ Add Trainee" }));
        const dialog = await screen.findByRole("dialog", { name: "Enroll Existing Trainee" });
        await user.type(within(dialog).getByLabelText(/Student ID/), "EXISTING_01");
        await user.type(within(dialog).getByLabelText(/Full Name/), "Existing Student");
        expect(within(dialog).getByLabelText(/Personal Email/)).toBeInTheDocument();
        expect(within(dialog).getByLabelText(/DOB/)).toBeInTheDocument();
        expect(within(dialog).getByLabelText(/Gender/)).toBeInTheDocument();
        expect(within(dialog).getByLabelText(/Status/)).toBeInTheDocument();
        await user.click(within(dialog).getByRole("button", { name: "Add Trainee" }));
        expect(await screen.findByText("Existing Student")).toBeInTheDocument();
        expect(fakeHttp.callsTo("put", "/classes/12/trainees/batch")).toHaveLength(0);
        await user.click(screen.getByRole("button", { name: /Save Changes/ }));
        await waitFor(() => expect(fakeHttp.callsTo("put", "/classes/12/trainees/batch")).toHaveLength(1));
    });
    it("paginates real memberships and exports selected rows without National ID", async () => {
        const trainees = Array.from({ length: 11 }, (_, index) => ({ id: index + 1, fptAccount: `STUDENT_${index + 1}`, fullName: `Test Student ${index + 1}`, nationalId: "999999999999", status: "Active" }));
        fakeHttp.on("get", "/classes/12/trainees", trainees);
        const { user } = renderAt(<TraineeListTab classItem={{ id: 12, traineeSource: "internal" }} />, { route: "/classes/12" });
        await screen.findByText("Showing 1–10 of 11 trainees");
        await user.click(screen.getByRole("button", { name: "Next trainees" }));
        expect(await screen.findByText("Showing 11–11 of 11 trainees")).toBeInTheDocument();
        await user.click(screen.getByRole("checkbox", { name: "Select Test Student 11" }));
        await user.click(screen.getByRole("button", { name: /Export Selected/ }));
        const workbook = vi.mocked(XLSX.writeFile).mock.calls[0][0];
        const exported = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);
        expect(exported).toHaveLength(1); expect(exported[0]["Student ID"]).toBe("STUDENT_11");
        expect(exported[0]).not.toHaveProperty("National ID");
    });
});
