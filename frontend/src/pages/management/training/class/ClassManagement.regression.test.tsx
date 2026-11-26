import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import * as XLSX from "xlsx";
import { fakeHttp, pageOf, type RecordedCall } from "@/test/fake-http";
import { renderAt } from "@/test/render";
import { clsApi } from "@/api/features/cls.api";
import { ClassModal } from "./components/ClassModal";
import ClassListPage from "./ClassListPage";

const renderHere = (element: Parameters<typeof renderAt>[0]) => renderAt(element, { route: "/classes" });

vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));
vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then(m => m.layoutModule()));
vi.mock("xlsx", async importOriginal => ({ ...await importOriginal<typeof import("xlsx")>(), writeFile: vi.fn() }));

const cls = { id: 42, code: "CLASS_42", name: "Synthetic class", status: "planning", program: "PROGRAM",
    startDate: "2030-06-01", endDate: "2030-09-01", plannedSize: 20,
    classAdmin: "Synthetic Admin", masterTrainer: "Synthetic Trainer" };

beforeEach(() => {
    fakeHttp.reset(); vi.mocked(XLSX.writeFile).mockReset();
    fakeHttp.on("get", "/programs", pageOf([{ id: 1, code: "PROGRAM", name: "Chương trình đào tạo", isActive: true, status: "ACTIVE" }]));
    fakeHttp.on("get", "/users", { content: [] });
    fakeHttp.on("get", "/trainers/options", pageOf([]));
    fakeHttp.on("get", "/trainers/data-source", { source: "INTERNAL", approved: true, sampleData: false });
    fakeHttp.on("get", "/classes", [cls]);
    fakeHttp.on("get", "/classes/stats", { totalClasses: 1, inProgress: 0, completedClasses: 0, upcomingClasses: 1 });
});

it("offers only planning when creating a class", () => {
    renderHere(<ClassModal open onOpenChange={vi.fn()} />);
    const select = document.querySelector<HTMLSelectElement>("#class-status")!;
    expect(Array.from(select.options, o => o.value)).toEqual(["planning"]);
});

it.each([
    ["planning", ["planning", "assigned", "cancelled"]],
    ["assigned", ["assigned", "active", "cancelled", "planning"]],
    ["active", ["active", "completed", "cancelled"]],
    ["completed", ["completed"]], // Closing remains backend-only.
    ["closed", ["closed"]],
    ["cancelled", ["cancelled"]],
])("offers valid edits for %s and preserves its saved status", (status, expected) => {
    renderHere(<ClassModal open classItem={{ ...cls, status }} onOpenChange={vi.fn()} />);
    const select = document.querySelector<HTMLSelectElement>("#class-status")!;
    expect(Array.from(select.options, o => o.value)).toEqual(expected);
    expect(select.value).toBe(status);
});

it("locks the class code after the class is closed", () => {
    renderHere(<ClassModal open classItem={{ ...cls, status: "closed" }} onOpenChange={vi.fn()} />);
    expect(document.querySelector("#class-code")).toBeDisabled();
});

it.each([
    ["planning", "assigned"], ["assigned", "planning"], ["assigned", "active"],
    ["active", "completed"], ["planning", "cancelled"], ["active", "cancelled"],
])("submits %s to %s through the internal class endpoint", async (initial, target) => {
    fakeHttp.on("put", "/classes/42", { ...cls, status: target });
    const { user } = renderHere(<ClassModal open classItem={{ ...cls, status: initial }} onOpenChange={vi.fn()} />);
    await user.selectOptions(document.querySelector<HTMLSelectElement>("#class-status")!, target);
    await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(fakeHttp.callsTo("put", "/classes/42")).toHaveLength(1));
    expect(fakeHttp.callsTo("put", "/classes/42")[0].data).toMatchObject({ code: cls.code, status: target });
});

async function exportedWorkbook() {
    await waitFor(() => expect(XLSX.writeFile).toHaveBeenCalledOnce());
    const book = vi.mocked(XLSX.writeFile).mock.calls[0][0];
    const bytes = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
    return XLSX.read(bytes, { type: "buffer" });
}

it("exports zero data rows, with headers, when the filter matches no classes", async () => {
    const { user } = renderHere(<ClassListPage />);
    await screen.findByRole("table", { name: "Classes" });
    const search = screen.getByRole("textbox", { name: /search/i });
    fireEvent.change(search, { target: { value: "DOES_NOT_EXIST" } });
    await screen.findByText("No classes match your search or filters.");
    await user.click(screen.getByRole("button", { name: "Export" }));
    const book = await exportedWorkbook();
    const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[book.SheetNames[0]], { header: 1 });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain("Mã lớp (Class Code)");
});

it("exports actual API data without inventing site or trainee type", async () => {
    const { user } = renderHere(<ClassListPage />);
    await screen.findByRole("table", { name: "Classes" });
    await user.click(screen.getByRole("button", { name: "Export" }));
    const book = await exportedWorkbook();
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[book.SheetNames[0]]);
    expect(rows).toHaveLength(1);
    expect(rows[0]["Mã lớp (Class Code)"]).toBe(cls.code);
    expect(rows[0]["Khu vực (Site)"]).toBe("");
    expect(rows[0]["Đối tượng (Trainee Type)"]).toBe("");
});

it("resolves a legacy code on a later API page to the numeric detail endpoint", async () => {
    fakeHttp.on("get", "/classes", (call: RecordedCall) => Number((call.params as { page?: number })?.page ?? 0) === 0
        ? { content: [{ ...cls, id: 1, code: "OTHER_CLASS" }], totalPages: 2, size: 1 }
        : { content: [cls], totalPages: 2, size: 1 });
    fakeHttp.on("get", "/classes/42", cls);
    const result = await clsApi.getClassById("CLASS_42");
    expect(result.data.id).toBe(42);
    expect(fakeHttp.callsTo("get", "/classes/42")).toHaveLength(1);
});
