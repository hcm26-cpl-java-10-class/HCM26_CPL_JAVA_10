import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeHttp, httpError, pageOf } from "@/test/fake-http";
import { renderAt } from "@/test/render";
import { ClassModal } from "./ClassModal";

vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));
const programs = [
    { id: 100, code: "ACTIVE_PROGRAM", name: "Đào tạo Java", isActive: true, status: "ACTIVE" },
    { id: 101, code: "OTHER_PROGRAM", name: "Đào tạo kiểm thử", isActive: true, status: "ACTIVE" },
    { id: 102, code: "INACTIVE_PROGRAM", name: "Chương trình ngừng hoạt động", isActive: true, status: "INACTIVE" },
    { id: 103, code: "DELETED_PROGRAM", name: "Chương trình đã xóa", isActive: false, status: "ACTIVE" },
];

beforeEach(() => {
    fakeHttp.reset();
    fakeHttp.on("get", "/programs", pageOf(programs));
    fakeHttp.on("get", "/users", { content: [{ id: 1, name: "Admin", email: "admin@test.com" }] });
    fakeHttp.on("get", "/trainers/options", pageOf([{ id: 10, fullName: "Trainer", status: "ACTIVE", source: "INTERNAL" }]));
    fakeHttp.on("get", "/trainers/data-source", { source: "INTERNAL", approved: true, sampleData: false });
});

const item = {
    id: 42,
    code: "CLASS_42",
    name: "Training class",
    status: "planning",
    program: "ACTIVE_PROGRAM",
    startDate: "2030-06-01",
    endDate: "2030-09-01",
    plannedSize: 20,
    site: "HCM",
    classAdmin: "Admin",
    masterTrainer: "Trainer",
    deliveryType: "Class",
    formatType: "Offline",
    location: "",
};

describe("ClassModal", () => {
    it("saves user-entered delivery, blended format and exact room name to the internal class endpoint", async () => {
        fakeHttp.on("get", "/users", { content: [{ id: 1, name: "Admin", email: "admin@test.com" }] });
        fakeHttp.on("get", "/trainers/options", pageOf([{ id: 10, fullName: "Trainer", status: "ACTIVE", source: "INTERNAL" }]));
        fakeHttp.on("get", "/trainers/data-source", { source: "INTERNAL", approved: true, sampleData: false });
        fakeHttp.on("put", "/classes/42", item);
        const done = vi.fn();
        const { user } = renderAt(<ClassModal open onOpenChange={done} classItem={item} />, { route: "/classes/42" });
        expect(document.querySelector<HTMLInputElement>("#class-location")?.value).toBe("");
        fireEvent.change(screen.getByLabelText(/^Loại hình triển khai/), { target: { value: "Instructor led" } });
        await user.selectOptions(document.querySelector<HTMLSelectElement>("#class-format-type")!, "Blended");
        fireEvent.change(document.querySelector<HTMLInputElement>("#class-location")!, { target: { value: "  Room from directory  " } });
        await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
        await waitFor(() => expect(done).toHaveBeenCalledWith(false));
        expect(fakeHttp.callsTo("put", "/classes/42")[0].data).toMatchObject({
            program: "ACTIVE_PROGRAM", deliveryType: "Instructor led", formatType: "Blended", location: "Room from directory",
        });
        expect(fakeHttp.calls.some(call => call.url.includes("/external/classes"))).toBe(false);
    });

    it("uses Vietnamese labels and placeholders throughout the class form", async () => {
        renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={item} />, { route: "/classes/42" });
        for (const label of ["Mã lớp học", "Tên hiển thị lớp học", "Chương trình đào tạo", "Khu vực", "Đối tượng", "Loại hình triển khai", "Hình thức đào tạo", "Trạng thái lớp học", "Ngày bắt đầu", "Ngày kết thúc", "Quản lý lớp", "Giảng viên chính"]) {
            expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeInTheDocument();
        }
        expect(screen.getByPlaceholderText("Mặc định lấy theo mã lớp")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Đóng" })).toBeInTheDocument();
        expect(screen.getByLabelText(/^Loại hình triển khai/)).toHaveValue("Lớp học");
        expect(screen.queryByText(/Enter the exact|Create Class|Delivery Type|Master Trainer|Class Code|Class Name/)).not.toBeInTheDocument();
    });

    it("renders Class Admin and Master Trainer as select dropdowns, not free text inputs (Yêu cầu 3)", async () => {
        renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={item} />, { route: "/classes/42" });
        const adminElement = document.querySelector("#class-admin");
        const trainerElement = document.querySelector("#class-trainer");
        expect(adminElement?.tagName.toLowerCase()).toBe("select");
        expect(trainerElement?.tagName.toLowerCase()).toBe("select");
    });

    it("preserves saved Class Admin and Master Trainer in edit mode (Yêu cầu 3)", async () => {
        renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={item} />, { route: "/classes/42" });
        const adminSelect = document.querySelector<HTMLSelectElement>("#class-admin");
        const trainerSelect = document.querySelector<HTMLSelectElement>("#class-trainer");
        expect(adminSelect?.value).toBe("Admin");
        expect(trainerSelect?.value).toBe("legacy");
    });

    it("displays a Vietnamese alert when the trainer directory is unverified", async () => {
        fakeHttp.on("get", "/users", { content: [{ id: 1, name: "Admin", email: "admin@test.com" }] });
        fakeHttp.on("get", "/trainers/options", pageOf([{ id: 10, fullName: "Sample Trainer", status: "ACTIVE", source: "INTERNAL" }]));
        fakeHttp.on("get", "/trainers/data-source", { source: "INTERNAL", approved: true, sampleData: true });
        renderAt(<ClassModal open onOpenChange={vi.fn()} />, { route: "/classes" });
        expect(await screen.findByText("Danh sách giảng viên nội bộ chưa được xác minh. Không thể chọn giảng viên.")).toBeInTheDocument();
        const trainerSelect = document.querySelector<HTMLSelectElement>("#class-trainer");
        expect(trainerSelect).toBeDisabled();
    });

    it("populates select options when verified users and trainers are loaded (Yêu cầu 3)", async () => {
        fakeHttp.on("get", "/users", {
            content: [
                { id: 1, name: "Nguyen Van Admin", email: "admin@corp.com" },
            ],
        });
        fakeHttp.on("get", "/trainers/options", pageOf([
            { id: 201, fullName: "Tran Van Trainer", status: "ACTIVE", email: "trainer@corp.com", source: "INTERNAL" },
        ]));
        fakeHttp.on("get", "/trainers/data-source", { source: "INTERNAL", approved: true, sampleData: false });

        renderAt(<ClassModal open onOpenChange={vi.fn()} />, { route: "/classes" });

        await waitFor(() => {
            const adminOption = screen.queryByRole("option", { name: /Nguyen Van Admin/i });
            expect(adminOption).toBeInTheDocument();
        });

        await waitFor(() => {
            const trainerOption = screen.queryByRole("option", { name: /Tran Van Trainer/i });
            expect(trainerOption).toBeInTheDocument();
        });
    });

    it("offers a single native program select with only active catalog entries and the same style as other selects", async () => {
        renderAt(<ClassModal open onOpenChange={vi.fn()} />, { route: "/classes" });
        const program = screen.getByLabelText(/^Chương trình đào tạo/) as HTMLSelectElement;
        await screen.findByRole("option", { name: "ACTIVE_PROGRAM — Đào tạo Java" });
        expect(program.tagName).toBe("SELECT");
        expect(program.multiple).toBe(false);
        expect(program).toHaveValue("");
        expect(program).toHaveClass(...screen.getByLabelText("Đối tượng").className.split(" "));
        expect(program.parentElement?.querySelector('svg[aria-hidden="true"]')).toBeInTheDocument();
        expect(screen.queryByRole("option", { name: /INACTIVE_PROGRAM|DELETED_PROGRAM/ })).not.toBeInTheDocument();
        expect(fakeHttp.callsTo("get", "/programs")[0].params).toEqual({ status: "ACTIVE", size: 1000, page: 0 });
    });

    it.each([
        { program: "ACTIVE_PROGRAM" },
        { program: "Đào tạo Java" },
        { program: "", trainingProgram: "ACTIVE_PROGRAM" },
        { program: "", programId: 100 },
    ])("restores an existing program saved as %j", async saved => {
        renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={{ ...item, ...saved }} />, { route: "/classes" });
        await waitFor(() => expect(screen.getByLabelText(/^Chương trình đào tạo/)).toHaveValue("100"));
    });

    it("requires a program in Vietnamese without submitting the form", async () => {
        const { user } = renderAt(<ClassModal open onOpenChange={vi.fn()} />, { route: "/classes" });
        await user.click(screen.getByRole("button", { name: "Tạo lớp học" }));
        expect(await screen.findByText("Vui lòng chọn chương trình đào tạo.")).toBeInTheDocument();
        expect(screen.getByLabelText(/^Chương trình đào tạo/)).toHaveAttribute("aria-invalid", "true");
        expect(fakeHttp.callsTo("post", "/classes")).toHaveLength(0);
    });

    it("creates with the selected catalog code and preserves the existing API values", async () => {
        fakeHttp.on("post", "/classes", item);
        const { user } = renderAt(<ClassModal open onOpenChange={vi.fn()} />, { route: "/classes" });
        await screen.findByRole("option", { name: "ACTIVE_PROGRAM — Đào tạo Java" });
        await user.selectOptions(screen.getByLabelText(/^Chương trình đào tạo/), "100");
        fireEvent.change(screen.getByLabelText(/^Mã lớp học/), { target: { value: "NEW_CLASS" } });
        await user.selectOptions(screen.getByLabelText(/^Quản lý lớp/), "Admin");
        await user.selectOptions(screen.getByLabelText(/^Giảng viên chính/), "10");
        await user.click(screen.getByRole("button", { name: "Tạo lớp học" }));
        await waitFor(() => expect(fakeHttp.callsTo("post", "/classes")).toHaveLength(1));
        expect(fakeHttp.callsTo("post", "/classes")[0].data).toMatchObject({
            code: "NEW_CLASS", program: "ACTIVE_PROGRAM", trainingProgram: "ACTIVE_PROGRAM",
            traineeType: "Fresher", deliveryType: "Class", formatType: "Offline",
        });
        expect(fakeHttp.calls.filter(c => c.method !== "get")).toHaveLength(1);
    });

    it("preserves a saved program name when editing other fields", async () => {
        fakeHttp.on("put", "/classes/42", item);
        const { user } = renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={{ ...item, program: "Đào tạo Java" }} />, { route: "/classes" });
        await screen.findByRole("option", { name: "ACTIVE_PROGRAM — Đào tạo Java" });
        await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
        await waitFor(() => expect(fakeHttp.callsTo("put", "/classes/42")).toHaveLength(1));
        expect(fakeHttp.callsTo("put", "/classes/42")[0].data).toMatchObject({ program: "Đào tạo Java" });
    });

    it("preserves an explicit program identity when active versions share the same code", async () => {
        fakeHttp.on("get", "/programs", pageOf([
            { ...programs[0], version: "1.0" },
            { ...programs[0], id: 104, version: "2.0" },
        ]));
        const { user } = renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={{ ...item, programId: 104 }} />, { route: "/classes" });
        const select = screen.getByLabelText(/^Chương trình đào tạo/);
        await waitFor(() => expect(select).toHaveValue("104"));
        await user.selectOptions(select, "100");
        expect(select).toHaveValue("100");
        await user.selectOptions(select, "104");
        expect(select).toHaveValue("104");
    });

    it("displays an unavailable saved program without making it selectable or submitting it", async () => {
        const { user } = renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={{ ...item, program: "INACTIVE_PROGRAM" }} />, { route: "/classes" });
        await screen.findByText("Chương trình đã lưu hiện không khả dụng. Vui lòng chọn chương trình đang hoạt động.");
        expect(screen.getByRole("option", { name: /INACTIVE_PROGRAM/ })).toBeDisabled();
        await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
        expect(await screen.findByText("Vui lòng chọn chương trình đào tạo đang hoạt động.")).toBeInTheDocument();
        expect(fakeHttp.callsTo("put", "/classes/42")).toHaveLength(0);
    });

    it("explains a program loading failure in Vietnamese and supports retry", async () => {
        fakeHttp.on("get", "/programs", () => { throw httpError(403); });
        const { user } = renderAt(<ClassModal open onOpenChange={vi.fn()} />, { route: "/classes" });
        expect(await screen.findByText("Không thể tải danh sách chương trình đào tạo. Vui lòng thử lại.")).toBeInTheDocument();
        expect(screen.getByLabelText(/^Chương trình đào tạo/)).toBeDisabled();
        fakeHttp.on("get", "/programs", pageOf(programs));
        await user.click(screen.getByRole("button", { name: "Tải lại chương trình đào tạo" }));
        await waitFor(() => expect(screen.getByLabelText(/^Chương trình đào tạo/)).toBeEnabled());
        expect(fakeHttp.callsTo("get", "/programs")).toHaveLength(2);
        expect(fakeHttp.calls.some(c => c.method !== "get")).toBe(false);
    });

    it("explains an empty active program catalog in Vietnamese", async () => {
        fakeHttp.on("get", "/programs", pageOf(programs.slice(2)));
        renderAt(<ClassModal open onOpenChange={vi.fn()} />, { route: "/classes" });
        expect(await screen.findByText("Chưa có chương trình đào tạo đang hoạt động.")).toBeInTheDocument();
        expect(screen.getByLabelText(/^Chương trình đào tạo/)).toBeDisabled();
    });

    it("shows a Vietnamese save error instead of displaying an English server message", async () => {
        fakeHttp.on("put", "/classes/42", () => { throw httpError(400, { message: "Program must be active" }); });
        const { user } = renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={item} />, { route: "/classes" });
        await screen.findByRole("option", { name: "ACTIVE_PROGRAM — Đào tạo Java" });
        await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
        expect(await screen.findByText("Thông tin lớp học chưa hợp lệ. Vui lòng kiểm tra lại chương trình đào tạo, giảng viên, địa điểm và thời gian.")).toBeInTheDocument();
        expect(screen.queryByText("Program must be active")).not.toBeInTheDocument();
    });
});
