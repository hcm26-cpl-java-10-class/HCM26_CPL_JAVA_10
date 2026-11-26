import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeHttp, httpError, pageOf, type RecordedCall } from "@/test/fake-http";
import { renderAt, createTestQueryClient } from "@/test/render";
import { ClassModal } from "./ClassModal";
import { useClasses } from "@/hooks/useClasses";

vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));

// Test fixtures only: these records never enter the application database or directory.
const trainers = [
    { id: 9100, fullName: "Verified Trainer", email: "trainer@example.test", status: "ACTIVE", source: "INTERNAL" },
    { id: 9101, fullName: "Inactive Trainer", email: "inactive@example.test", status: "INACTIVE", source: "INTERNAL" },
];
const savedClass = {
    id: 42, code: "CLASS_42", name: "Training class", status: "planning", program: "PROGRAM",
    startDate: "2030-06-01", endDate: "2030-09-01", plannedSize: 20, site: "HCM",
    classAdmin: "Existing Admin", masterTrainer: "Existing Trainer",
    deliveryType: "Class", formatType: "Online", location: "https://example.test/meeting",
};

beforeEach(() => {
    fakeHttp.reset();
    fakeHttp.on("get", "/programs", pageOf([
        { id: 1, code: "PROGRAM", name: "Chương trình đang hoạt động", status: "ACTIVE", isActive: true },
    ]));
    fakeHttp.on("get", "/users", { content: [
        { id: 1, firstName: "Active", lastName: "Admin", email: "admin@example.test", status: "ACTIVE" },
        { id: 2, firstName: "Locked", lastName: "Admin", status: "LOCKED" },
        { id: 3, firstName: "Inactive", lastName: "Admin", status: "INACTIVE" },
    ] });
    fakeHttp.on("get", "/trainers/options", pageOf(trainers));
    fakeHttp.on("get", "/trainers/data-source", { source: "INTERNAL", approved: true, sampleData: false });
});

const trainerSelect = () => screen.getByLabelText(/^Giảng viên chính/i) as HTMLSelectElement;
const adminSelect = () => document.querySelector<HTMLSelectElement>("#class-admin")!;

describe("ClassModal Master Trainer directory contract", () => {
    it("does not reuse cached external options while the internal directory is loading", () => {
        const client = createTestQueryClient();
        client.setQueryData(["class-setup", "verified-trainers"], [{ id: 1, name: "Cached External Sample", status: "active" }]);
        fakeHttp.on("get", "/trainers/options", () => new Promise(() => {}));
        renderAt(<ClassModal open onOpenChange={vi.fn()} />, { route: "/classes", client });
        expect(trainerSelect()).toBeDisabled();
        expect(screen.queryByRole("option", { name: /Cached External Sample/ })).not.toBeInTheDocument();
    });
    it("disambiguates equal names by internal ID and preserves an explicitly saved identity", async () => {
        fakeHttp.on("get", "/trainers/options", pageOf([trainers[0], { ...trainers[0], id: 9200, email: "other@example.test" }]));
        fakeHttp.on("put", "/classes/42", savedClass);
        const { user } = renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={{ ...savedClass, masterTrainer: "Verified Trainer", masterTrainerId: 9100 }} />, { route: "/classes" });
        await screen.findByRole("option", { name: "Verified Trainer (other@example.test)" });
        expect(trainerSelect().value).toBe("9100");
        await user.selectOptions(trainerSelect(), "9200");
        await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
        await waitFor(() => expect(fakeHttp.callsTo("put", "/classes/42")).toHaveLength(1));
        expect(fakeHttp.callsTo("put", "/classes/42")[0].data).toMatchObject({ masterTrainer: "Verified Trainer", masterTrainerId: 9200 });
    });
    it("selects only active verified trainers and preserves the Class API string payload", async () => {
        fakeHttp.on("put", "/classes/42", savedClass);
        const done = vi.fn();
        const { user } = renderAt(<ClassModal open onOpenChange={done} classItem={savedClass} />, { route: "/classes" });
        await screen.findByRole("option", { name: "Verified Trainer (trainer@example.test)" });
        expect(trainerSelect().tagName).toBe("SELECT");
        expect(screen.queryByRole("option", { name: /Inactive Trainer/ })).not.toBeInTheDocument();
        expect(fakeHttp.callsTo("get", "/trainers/options")[0].params).toEqual({ page: 0, size: 100 });
        await user.selectOptions(trainerSelect(), "9100");
        await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
        await waitFor(() => expect(done).toHaveBeenCalledWith(false));
        expect(fakeHttp.callsTo("put", "/classes/42")[0].data).toMatchObject({
            masterTrainer: "Verified Trainer", masterTrainerId: 9100, classAdmin: savedClass.classAdmin,
            program: savedClass.program, formatType: savedClass.formatType, location: savedClass.location,
        });
        expect(fakeHttp.callsTo("post", "/external/classes")).toHaveLength(0);
    });

    it.each([true, undefined, null, "false"])("blocks sample or unverified provenance %s while Class Admin remains selectable", async sampleData => {
        fakeHttp.on("get", "/trainers/data-source", { source: "INTERNAL", approved: true, sampleData });
        const { user } = renderAt(<ClassModal open onOpenChange={vi.fn()} />, { route: "/classes" });
        await screen.findByRole("alert");
        expect(trainerSelect()).toBeDisabled();
        expect(screen.queryByRole("option", { name: /Verified Trainer/ })).not.toBeInTheDocument();
        expect(screen.getByRole("alert")).toHaveTextContent("chưa được xác minh");
        await screen.findByRole("option", { name: "Active Admin (admin@example.test)" });
        expect(adminSelect()).toBeEnabled();
        expect(adminSelect().tagName).toBe("SELECT");
        expect(screen.queryByRole("option", { name: "Locked Admin" })).not.toBeInTheDocument();
        expect(screen.queryByRole("option", { name: "Inactive Admin" })).not.toBeInTheDocument();
        await user.selectOptions(adminSelect(), "Active Admin");
        expect(adminSelect().value).toBe("Active Admin");
    });

    for (const endpoint of ["/trainers/options", "/trainers/data-source"]) {
        it.each([401, 403, 404, 500])(`blocks failed ${endpoint} HTTP %s without offering trainers`, async status => {
            fakeHttp.on("get", endpoint, () => { throw httpError(status); });
            renderAt(<ClassModal open onOpenChange={vi.fn()} />, { route: "/classes" });
            await screen.findByRole("alert");
            expect(trainerSelect()).toBeDisabled();
            expect(screen.getByRole("alert")).toHaveTextContent(/giảng viên/i);
            expect(screen.queryByRole("option", { name: /Verified Trainer/ })).not.toBeInTheDocument();
            expect(adminSelect()).toBeEnabled();
        });
    }

    it("blocks an empty active directory", async () => {
        fakeHttp.on("get", "/trainers/options", pageOf([trainers[1]]));
        renderAt(<ClassModal open onOpenChange={vi.fn()} />, { route: "/classes" });
        await screen.findByRole("alert");
        expect(trainerSelect()).toBeDisabled();
        expect(screen.getByRole("alert")).toHaveTextContent(/giảng viên/i);
    });

    it("explains the missing internal data and reloads after a real directory becomes available", async () => {
        fakeHttp.on("get", "/trainers/options", pageOf([]));
        const { user } = renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={savedClass} />, { route: "/classes" });
        expect(await screen.findByRole("alert")).toHaveTextContent("Quản lý giảng viên");
        expect(screen.getByRole("alert")).toHaveTextContent("bổ sung hoặc cập nhật hồ sơ");
        expect(trainerSelect()).toBeDisabled();
        expect(trainerSelect().value).toBe("legacy");
        fakeHttp.on("get", "/trainers/options", pageOf(trainers));
        await user.click(screen.getByRole("button", { name: "Tải lại danh sách giảng viên" }));
        await waitFor(() => expect(trainerSelect()).toBeEnabled());
        await user.selectOptions(trainerSelect(), "9100");
        expect(trainerSelect().value).toBe("9100");
        expect(fakeHttp.calls.some(c => c.method !== "get")).toBe(false);
        expect(fakeHttp.calls.some(c => c.url.startsWith("/external"))).toBe(false);
    });

    it("keeps a forbidden directory blocked on retry without enabling unauthorized trainers", async () => {
        fakeHttp.on("get", "/trainers/options", () => { throw httpError(403); });
        const { user } = renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={savedClass} />, { route: "/classes" });
        expect(await screen.findByRole("alert")).toHaveTextContent("Thiếu quyền");
        await user.click(screen.getByRole("button", { name: "Tải lại danh sách giảng viên" }));
        await waitFor(() => expect(fakeHttp.callsTo("get", "/trainers/options")).toHaveLength(2));
        expect(await screen.findByRole("alert")).toHaveTextContent("Thiếu quyền");
        expect(trainerSelect()).toBeDisabled();
        expect(adminSelect()).toBeEnabled();
    });

    it("blocks a cached selection during revalidation and rejects it after the trainer becomes inactive", async () => {
        const client = createTestQueryClient();
        client.setQueryData(["class-setup", "verified-trainers", "INTERNAL"], [
            { id: 9100, name: "Verified Trainer", email: "trainer@example.test", status: "active" },
        ]);
        let finish!: (value: ReturnType<typeof pageOf>) => void;
        fakeHttp.on("get", "/trainers/options", () => new Promise(resolve => { finish = resolve; }));
        const { user } = renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={savedClass} />, { route: "/classes", client });
        expect(trainerSelect()).toBeDisabled();
        expect(screen.getByText("Đang kiểm tra danh sách giảng viên...")).toBeInTheDocument();
        await screen.findByRole("option", { name: "PROGRAM — Chương trình đang hoạt động" });
        // A stale DOM selection must also be rejected by submit validation.
        fireEvent.change(trainerSelect(), { target: { value: "9100" } });
        await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
        expect(await screen.findByText(/Vui lòng chờ trước khi lưu/)).toBeInTheDocument();
        expect(fakeHttp.callsTo("put", "/classes/42")).toHaveLength(0);
        await act(async () => finish(pageOf([trainers[1]])));
        await waitFor(() => expect(screen.queryByText("Đang kiểm tra danh sách giảng viên...")).not.toBeInTheDocument());
        expect(trainerSelect()).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
        expect(fakeHttp.callsTo("put", "/classes/42")).toHaveLength(0);
    });

    it("creates a class with an explicitly selected active internal identity", async () => {
        fakeHttp.on("post", "/classes", savedClass);
        const { user } = renderAt(<ClassModal open onOpenChange={vi.fn()} />, { route: "/classes" });
        await screen.findByRole("option", { name: "Verified Trainer (trainer@example.test)" });
        fireEvent.change(document.querySelector("#class-code")!, { target: { value: "NEW_CLASS" } });
        await user.selectOptions(screen.getByLabelText(/^Chương trình đào tạo/), "1");
        await user.selectOptions(adminSelect(), "Active Admin");
        await user.selectOptions(trainerSelect(), "9100");
        await user.click(screen.getByRole("button", { name: "Tạo lớp học" }));
        await waitFor(() => expect(fakeHttp.callsTo("post", "/classes")).toHaveLength(1));
        expect(fakeHttp.callsTo("post", "/classes")[0].data).toMatchObject({
            code: "NEW_CLASS", masterTrainerId: 9100, masterTrainer: "Verified Trainer", classAdmin: "Active Admin",
        });
    });

    it("refreshes the class list and detail after saving and reads the saved identity on remount", async () => {
        let persisted = { ...savedClass, masterTrainerId: null as number | null };
        fakeHttp.on("get", "/classes/42", () => persisted);
        fakeHttp.on("get", "/classes", () => pageOf([persisted]));
        fakeHttp.on("put", "/classes/42", (call: RecordedCall) => {
            persisted = { ...persisted, ...(call.data as Partial<typeof persisted>) };
            return persisted;
        });
        function ClassSnapshot() {
            const detail = useClasses({ classId: 42 });
            const list = useClasses();
            return <><span data-testid="detail-trainer">{detail.data?.masterTrainer}</span>
                <span data-testid="list-trainer">{list.data?.[0]?.masterTrainer}</span></>;
        }
        const view = renderAt(<><ClassSnapshot /><ClassModal open onOpenChange={vi.fn()} classItem={savedClass} /></>, { route: "/classes" });
        await waitFor(() => expect(screen.getByTestId("list-trainer")).toHaveTextContent(savedClass.masterTrainer));
        await screen.findByRole("option", { name: "Verified Trainer (trainer@example.test)" });
        await view.user.selectOptions(trainerSelect(), "9100");
        await view.user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
        await waitFor(() => {
            expect(screen.getByTestId("detail-trainer")).toHaveTextContent("Verified Trainer");
            expect(screen.getByTestId("list-trainer")).toHaveTextContent("Verified Trainer");
        });
        view.unmount();
        renderAt(<><ClassSnapshot /><ClassModal open onOpenChange={vi.fn()} classItem={persisted} /></>, { route: "/classes" });
        await waitFor(() => expect(trainerSelect()).toBeEnabled());
        expect(trainerSelect().value).toBe("9100");
        expect(await screen.findByTestId("detail-trainer")).toHaveTextContent("Verified Trainer");
    });

    it("retains the saved legacy identity when editing other fields with an empty directory", async () => {
        fakeHttp.on("get", "/trainers/options", pageOf([]));
        fakeHttp.on("put", "/classes/42", savedClass);
        const { user } = renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={savedClass} />, { route: "/classes" });
        await screen.findByRole("alert");
        fireEvent.change(document.querySelector("#class-name")!, { target: { value: "Updated class name" } });
        await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
        await waitFor(() => expect(fakeHttp.callsTo("put", "/classes/42")).toHaveLength(1));
        expect(fakeHttp.callsTo("put", "/classes/42")[0].data).toMatchObject({
            name: "Updated class name", masterTrainer: savedClass.masterTrainer, masterTrainerId: null, classAdmin: savedClass.classAdmin,
        });
    });

    it("retains an existing trainer in edit mode without presenting sample trainers as alternatives", async () => {
        fakeHttp.on("get", "/trainers/data-source", { source: "INTERNAL", approved: true, sampleData: true });
        renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={savedClass} />, { route: "/classes" });
        await screen.findByRole("alert");
        expect(trainerSelect().value).toBe("legacy");
        expect(screen.queryByRole("option", { name: /Verified Trainer/ })).not.toBeInTheDocument();
    });
});
