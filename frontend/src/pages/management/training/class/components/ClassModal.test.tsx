import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeHttp } from "@/test/fake-http";
import { renderAt } from "@/test/render";
import { ClassModal } from "./ClassModal";

vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));
beforeEach(() => fakeHttp.reset());

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
        fakeHttp.on("get", "/external/trainers", [{ id: 10, name: "Trainer", status: "active" }]);
        fakeHttp.on("get", "/external/data-source", { sampleData: false });
        fakeHttp.on("put", "/classes/42", item);
        const done = vi.fn();
        const { user } = renderAt(<ClassModal open onOpenChange={done} classItem={item} />, { route: "/classes/42" });
        expect(document.querySelector<HTMLInputElement>("#class-location")?.value).toBe("");
        fireEvent.change(screen.getByLabelText("Delivery Type"), { target: { value: "Instructor led" } });
        await user.selectOptions(document.querySelector<HTMLSelectElement>("#class-format-type")!, "Blended");
        fireEvent.change(document.querySelector<HTMLInputElement>("#class-location")!, { target: { value: "  Room from directory  " } });
        await user.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
        await waitFor(() => expect(done).toHaveBeenCalledWith(false));
        expect(fakeHttp.callsTo("put", "/classes/42")[0].data).toMatchObject({
            program: "ACTIVE_PROGRAM", deliveryType: "Instructor led", formatType: "Blended", location: "Room from directory",
        });
        expect(fakeHttp.calls.some(call => call.url.includes("/external/classes"))).toBe(false);
    });

    it("displays Master Trainer label without 'Giáo viên chính' (Yêu cầu 4)", async () => {
        renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={item} />, { route: "/classes/42" });
        expect(screen.getByLabelText(/^Master Trainer/i)).toBeInTheDocument();
        expect(screen.queryByText(/Giáo viên chính/i)).not.toBeInTheDocument();
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
        expect(trainerSelect?.value).toBe("Trainer");
    });

    it("displays BLOCKED alert when Master Trainer API returns sample or unverified data (Yêu cầu 3)", async () => {
        fakeHttp.on("get", "/users", { content: [{ id: 1, name: "Admin", email: "admin@test.com" }] });
        fakeHttp.on("get", "/external/trainers", [{ id: 10, name: "Sample Trainer", status: "active" }]);
        fakeHttp.on("get", "/external/data-source", { sampleData: true });
        renderAt(<ClassModal open onOpenChange={vi.fn()} />, { route: "/classes" });
        const alerts = await screen.findAllByRole("alert");
        const blockedAlert = alerts.find(a => a.textContent?.includes("BLOCKED"));
        expect(blockedAlert).toBeDefined();
        const trainerSelect = document.querySelector<HTMLSelectElement>("#class-trainer");
        expect(trainerSelect).toBeDisabled();
    });

    it("populates select options when verified users and trainers are loaded (Yêu cầu 3)", async () => {
        fakeHttp.on("get", "/users", {
            content: [
                { id: 1, name: "Nguyen Van Admin", email: "admin@corp.com" },
            ],
        });
        fakeHttp.on("get", "/external/trainers", [
            { id: 201, name: "Tran Van Trainer", status: "active", email: "trainer@corp.com" },
        ]);
        fakeHttp.on("get", "/external/data-source", { sampleData: false });

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
});
