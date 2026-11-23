import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeHttp, httpError, pageOf } from "@/test/fake-http";
import { renderAt, createTestQueryClient } from "@/test/render";
import { ClassModal } from "./ClassModal";

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
    fakeHttp.on("get", "/users", { content: [
        { id: 1, firstName: "Active", lastName: "Admin", email: "admin@example.test", status: "ACTIVE" },
        { id: 2, firstName: "Locked", lastName: "Admin", status: "LOCKED" },
        { id: 3, firstName: "Inactive", lastName: "Admin", status: "INACTIVE" },
    ] });
    fakeHttp.on("get", "/trainers/options", pageOf(trainers));
    fakeHttp.on("get", "/trainers/data-source", { source: "INTERNAL", approved: true, sampleData: false });
});

const trainerSelect = () => screen.getByLabelText(/^Master Trainer/i) as HTMLSelectElement;
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
        expect(screen.getByRole("alert")).toHaveTextContent("sample or unverified");
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
            expect(screen.getByRole("alert")).toHaveTextContent("BLOCKED");
            expect(screen.queryByRole("option", { name: /Verified Trainer/ })).not.toBeInTheDocument();
            expect(adminSelect()).toBeEnabled();
        });
    }

    it("blocks an empty active directory", async () => {
        fakeHttp.on("get", "/trainers/options", pageOf([trainers[1]]));
        renderAt(<ClassModal open onOpenChange={vi.fn()} />, { route: "/classes" });
        await screen.findByRole("alert");
        expect(trainerSelect()).toBeDisabled();
        expect(screen.getByRole("alert")).toHaveTextContent("BLOCKED");
    });

    it("retains an existing trainer in edit mode without presenting sample trainers as alternatives", async () => {
        fakeHttp.on("get", "/trainers/data-source", { source: "INTERNAL", approved: true, sampleData: true });
        renderAt(<ClassModal open onOpenChange={vi.fn()} classItem={savedClass} />, { route: "/classes" });
        await screen.findByRole("alert");
        expect(trainerSelect().value).toBe("legacy");
        expect(screen.queryByRole("option", { name: /Verified Trainer/ })).not.toBeInTheDocument();
    });
});
