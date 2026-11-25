import { screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { fakeHttp, httpError, pageOf } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderAt } from "@/test/render";
import TrainerManagementPage from "./TrainerManagementPage";
import { TrainerImportModal } from "./TrainerImportModal";

vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then(m => m.permissionsModule()));
vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then(m => m.layoutModule()));
const trainer = { id: 12, trainerCode: "TR_12", fullName: "Trainer Twelve", email: "trainer12@example.test", specialization: "Java", status: "ACTIVE", source: "INTERNAL", teachingTopics: [] };
beforeEach(() => {
    fakeHttp.reset(); grant("TRAINER_READ", "TRAINER_CREATE", "TRAINER_UPDATE", "TRAINER_DELETE");
    fakeHttp.on("get", "/trainers", pageOf([trainer]));
    fakeHttp.on("get", "/trainers/12", trainer);
    fakeHttp.on("get", "/trainers/teaching-topics", [{ id: 5, code: "JAVA", name: "Java", version: "1", active: true }]);
});

it("lists, searches and filters trainers on the server", async () => {
    const { user } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    await screen.findByText("Trainer Twelve");
    await user.type(screen.getByLabelText("Search Trainers"), "Java");
    await user.selectOptions(screen.getByLabelText("Filter Trainer Status"), "ACTIVE");
    await waitFor(() => expect(fakeHttp.callsTo("get", "/trainers").at(-1)?.params).toEqual({ search: "Java", status: "ACTIVE", page: 0, size: 20 }));
});

it("creates a trainer with existing teaching topic IDs", async () => {
    fakeHttp.on("post", "/trainers", trainer);
    const { user } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    await user.click(screen.getByRole("button", { name: "Add Trainer" }));
    const javaCheckbox = await screen.findByRole("checkbox", { name: /JAVA@1/ });
    await user.type(screen.getByLabelText("Trainer ID *"), "TR_NEW");
    await user.type(screen.getByLabelText("Full Name *"), "New Trainer");
    await user.type(screen.getByLabelText("Work Email *"), "new@example.test");
    await user.click(javaCheckbox);
    await user.click(screen.getByRole("button", { name: "Save Trainer" }));
    await screen.findByText("Trainer saved.");
    expect(fakeHttp.callsTo("post", "/trainers")[0].data).toMatchObject({ trainerCode: "TR_NEW", fullName: "New Trainer", email: "new@example.test", teachingTopicIds: [5], status: "ACTIVE" });
});

it("edits, views and changes status without changing the identity", async () => {
    fakeHttp.on("put", "/trainers/12", trainer); fakeHttp.on("patch", "/trainers/12/status", trainer);
    const { user } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    await user.click(await screen.findByRole("button", { name: "View TR_12" }));
    await screen.findByRole("dialog", { name: /Trainer Details/ }); await user.click(screen.getByRole("button", { name: "Close Details" }));
    await user.click(screen.getByRole("button", { name: "Edit TR_12" }));
    await screen.findByRole("checkbox", { name: /JAVA@1/ });
    await user.clear(screen.getByLabelText("Full Name *")); await user.type(screen.getByLabelText("Full Name *"), "Updated Name");
    await user.click(screen.getByRole("button", { name: "Save Trainer" })); await screen.findByText("Trainer saved.");
    expect(fakeHttp.callsTo("put", "/trainers/12")[0].data).toMatchObject({ fullName: "Updated Name" });
    await user.click(screen.getByRole("button", { name: "Deactivate TR_12" })); await screen.findByText("Trainer status updated.");
    expect(fakeHttp.callsTo("patch", "/trainers/12/status")[0].data).toEqual({ status: "INACTIVE" });
});

it("keeps a referenced trainer when the server refuses archive", async () => {
    fakeHttp.on("delete", "/trainers/12", () => { throw httpError(409, { message: "Trainer is referenced. Set INACTIVE instead." }); });
    const { user } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    await user.click(await screen.findByRole("button", { name: "Archive TR_12" }));
    await user.click(screen.getByRole("button", { name: "Confirm Archive" }));
    await waitFor(() => expect(screen.getAllByRole("alert").some(a => a.textContent?.includes("Set INACTIVE"))).toBe(true));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
});

it("hides write actions for read-only users and avoids requests without read permission", async () => {
    grant("TRAINER_READ");
    const view = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    await screen.findByText("Trainer Twelve");
    expect(screen.queryByRole("button", { name: "Add Trainer" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit TR_12" })).not.toBeInTheDocument();
    view.unmount(); fakeHttp.reset(); grant();
    renderAt(<TrainerManagementPage />, { route: "/trainers" });
    expect(screen.getByRole("alert")).toHaveTextContent("Access denied"); expect(fakeHttp.calls).toHaveLength(0);
});

it.each([401, 403, 404, 500])("reports HTTP %s instead of pretending the trainer list is empty", async status => {
    fakeHttp.on("get", "/trainers", () => { throw httpError(status); });
    renderAt(<TrainerManagementPage />, { route: "/trainers" });
    expect(await screen.findByRole("alert")).toHaveTextContent(`HTTP ${status}`);
    expect(screen.queryByText("No trainers match the current filters.")).not.toBeInTheDocument();
});

it.each([false, true])("previews the Trainer Excel and commits only a fully valid file (%s)", async valid => {
    fakeHttp.on("post", "/trainers/import/preview", { totalRows: 1, validRows: valid ? 1 : 0, canImport: valid,
        rows: [{ rowNumber: 2, cells: ["TR_X", "Excel Trainer", "excel@example.test", "", "", "ACTIVE"], valid, errors: valid ? [] : ["Duplicate Work Email"] }] });
    fakeHttp.on("post", "/trainers/import", { imported: 1 });
    const saved = vi.fn(async () => {}); const close = vi.fn();
    const { user } = renderAt(<TrainerImportModal saved={saved} close={close} />, { route: "/trainers" });
    await user.upload(screen.getByLabelText("Upload Trainer Excel"), new File(["test fixture"], "trainers.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    await screen.findByText("Excel Trainer");
    const commit = screen.getByRole("button", { name: "Import All Trainers" });
    if (!valid) { expect(commit).toBeDisabled(); expect(screen.getByText("Duplicate Work Email")).toBeInTheDocument(); }
    else { await user.click(commit); await waitFor(() => expect(saved).toHaveBeenCalled()); expect(close).toHaveBeenCalled(); }
    expect(fakeHttp.callsTo("post", "/trainers/import")).toHaveLength(valid ? 1 : 0);
    expect(fakeHttp.calls.some(c => c.url.includes("trainee"))).toBe(false);
});

it("clamps to the last valid page after deactivating the sole trainer on page 2 of Active filter while keeping filters", async () => {
    const records = Array.from({ length: 21 }, (_, idx) => ({
        id: idx + 1,
        trainerCode: `TR_${String(idx + 1).padStart(2, "0")}`,
        fullName: `Active Trainer ${idx + 1}`,
        email: `trainer${idx + 1}@example.test`,
        specialization: "Java",
        status: "ACTIVE" as "ACTIVE" | "INACTIVE",
        source: "INTERNAL",
        teachingTopics: [],
    }));

    fakeHttp.on("get", "/trainers", (req: { params?: Record<string, unknown> }) => {
        const filterStatus = String(req.params?.status ?? "all");
        const filterSearch = String(req.params?.search ?? "").trim().toLowerCase();
        const reqPage = Number(req.params?.page ?? 0);
        const reqSize = Number(req.params?.size ?? 20);
        const filtered = records.filter(item =>
            (filterStatus === "all" || item.status === filterStatus)
            && (!filterSearch || item.fullName.toLowerCase().includes(filterSearch) || item.trainerCode.toLowerCase().includes(filterSearch)),
        );
        const totalPages = Math.ceil(filtered.length / reqSize);
        const slice = filtered.slice(reqPage * reqSize, (reqPage + 1) * reqSize);
        return { content: slice, totalElements: filtered.length, totalPages };
    });

    fakeHttp.on("patch", "/trainers/21/status", () => {
        records[20].status = "INACTIVE";
        return records[20];
    });

    const { user } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    await screen.findByText("Active Trainer 1");

    await user.type(screen.getByLabelText("Search Trainers"), "Active");
    await user.selectOptions(screen.getByLabelText("Filter Trainer Status"), "ACTIVE");
    await screen.findByText("21 trainers · Page 1 / 2");

    await user.click(screen.getByRole("button", { name: "Next" }));
    await screen.findByText("Active Trainer 21");
    expect(screen.getByText("21 trainers · Page 2 / 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Deactivate TR_21" }));

    await screen.findByText("20 trainers · Page 1 / 1");
    expect(screen.getByText("Active Trainer 1")).toBeInTheDocument();
    expect(screen.getByText("Active Trainer 20")).toBeInTheDocument();
    expect(screen.queryByText("Active Trainer 21")).not.toBeInTheDocument();

    const lastCall = fakeHttp.callsTo("get", "/trainers").at(-1);
    expect(lastCall?.params).toEqual({ search: "Active", status: "ACTIVE", page: 0, size: 20 });
});

it("uses a v-flag-compatible Trainer ID pattern and rejects domainless Work Email like review@localhost", async () => {
    const { user } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    await screen.findByText("Trainer Twelve");

    await user.click(screen.getByRole("button", { name: "Add Trainer" }));
    await screen.findByRole("checkbox", { name: /JAVA@1/ });
    const codeInput = screen.getByLabelText("Trainer ID *") as HTMLInputElement;
    const pattern = codeInput.getAttribute("pattern") ?? "";

    // Must compile cleanly under HTML's unicodeSets (v) flag
    const vRegex = new RegExp(`^(?:${pattern})$`, "v");
    expect(vRegex.test("TR-01_A")).toBe(true);
    expect(vRegex.test("A".repeat(20))).toBe(true);
    expect(vRegex.test("A".repeat(21))).toBe(false);
    expect(vRegex.test("TR@01")).toBe(false);
    expect(vRegex.test("_TR01")).toBe(false);
    expect(codeInput.maxLength).toBe(20);

    await user.type(codeInput, "TR-02_B");
    await user.type(screen.getByLabelText("Full Name *"), "Local Email Trainer");
    await user.type(screen.getByLabelText("Work Email *"), "review@localhost");
    await user.click(screen.getByRole("button", { name: "Save Trainer" }));

    expect(await screen.findByText(/Work Email must be a valid email address/i)).toBeInTheDocument();
    expect(fakeHttp.callsTo("post", "/trainers")).toHaveLength(0);
});

it("preserves legacy over-length fields without silent truncation, clearly flags which field to shorten, and saves once fixed", async () => {
    const legacyName = "L".repeat(92);
    const legacySpec = "S".repeat(215);
    const legacyTrainer = {
        id: 9,
        trainerCode: "TR_LEGACY",
        fullName: legacyName,
        email: "legacy@example.test",
        specialization: legacySpec,
        status: "ACTIVE" as const,
        source: "INTERNAL",
        teachingTopics: [],
    };
    let savedPayload: unknown = null;

    fakeHttp.on("get", "/trainers", {
        content: [legacyTrainer],
        totalElements: 1,
        totalPages: 1,
    });
    fakeHttp.on("get", "/trainers/9", legacyTrainer);
    fakeHttp.on("put", "/trainers/9", (req: { data?: unknown }) => {
        savedPayload = req.data;
        return {
            id: 9,
            ...(req.data as Record<string, unknown>),
            source: "INTERNAL",
            teachingTopics: [],
        };
    });

    const { user } = renderAt(<TrainerManagementPage />, { route: "/trainers" });
    await screen.findByText("TR_LEGACY");
    await user.click(screen.getByRole("button", { name: "Edit TR_LEGACY" }));

    const nameInput = await screen.findByLabelText("Full Name *") as HTMLInputElement;
    await screen.findByRole("checkbox", { name: /JAVA@1/ });
    const specInput = screen.getByLabelText("Specialization") as HTMLInputElement;

    // Legacy values are NOT silently truncated
    expect(nameInput.value).toBe(legacyName);
    expect(specInput.value).toBe(legacySpec);
    expect(screen.getByText(/Full Name exceeds the 80-character limit/i)).toBeInTheDocument();
    expect(screen.getByText(/Specialization exceeds the 200-character limit/i)).toBeInTheDocument();

    // Submitting before fixing is blocked cleanly
    await user.click(screen.getByRole("button", { name: "Save Trainer" }));
    expect(fakeHttp.callsTo("put", "/trainers/9")).toHaveLength(0);

    // Once shortened within limits, save succeeds
    await user.clear(nameInput);
    await user.type(nameInput, "Shortened Legacy Name");
    await user.clear(specInput);
    await user.type(specInput, "Java, Spring");
    await user.click(screen.getByRole("button", { name: "Save Trainer" }));

    await waitFor(() => expect(fakeHttp.callsTo("put", "/trainers/9")).toHaveLength(1));
    expect((savedPayload as { fullName?: string; specialization?: string })?.fullName).toBe("Shortened Legacy Name");
    expect((savedPayload as { fullName?: string; specialization?: string })?.specialization).toBe("Java, Spring");
});