import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeHttp, httpError } from "@/test/fake-http";
import { renderAt } from "@/test/render";
import { grant } from "@/test/mocks";
import { ClassReadinessPanel } from "./ClassReadinessPanel";
vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then(m => m.permissionsModule()));
const readiness = { classId: 12, ready: 1, verified: 3, unknown: 2, notReady: 2, enrolledTrainees: 0, evaluatedAt: "2026-11-07T01:00:00Z",
    checks: [
        { key: "basic", label: "Basic Information", status: "UNKNOWN", reason: "No verified program link", target: "setup" },
        { key: "trainer", label: "Trainer Assignment", status: "UNKNOWN", reason: "Directory unavailable", target: "setup" },
        { key: "enrollment", label: "Trainee Enrollment", status: "NOT_READY", reason: "No active trainees", target: "trainees" },
        { key: "calendar", label: "Calendar Readiness", status: "NOT_READY", reason: "No sessions", target: "calendar" },
        { key: "operations", label: "Operational Information", status: "READY", reason: "Valid venue", target: "edit" },
    ] };
beforeEach(() => { fakeHttp.reset(); grant("CLASS_READ", "CLASS_UPDATE"); fakeHttp.on("get", "/classes/12/readiness", readiness); });
describe("Class Readiness", () => {
    it("shows verified totals separately from unknown and navigates without writing data", async () => {
        const onNavigate = vi.fn();
        const { user } = renderAt(<ClassReadinessPanel classItem={{ id: 12, code: "SMART_12" }} onNavigate={onNavigate} />, { route: "/classes/12?tab=info" });
        expect(await screen.findByText("1/3 verified checks ready, 2 unknown.")).toBeInTheDocument();
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "3");
        expect(screen.getAllByText("UNKNOWN")).toHaveLength(2);
        await user.click(screen.getByRole("button", { name: "Open Trainee List" }));
        expect(onNavigate).toHaveBeenCalledWith("trainees");
        await user.click(screen.getByRole("button", { name: "Open Calendar" }));
        expect(onNavigate).toHaveBeenCalledWith("calendar");
        expect(fakeHttp.calls.every(c => c.method === "get")).toBe(true);
    });
    it("shows access denied for HTTP 403 instead of invented readiness", async () => {
        fakeHttp.on("get", "/classes/12/readiness", () => { throw httpError(403); });
        renderAt(<ClassReadinessPanel classItem={{ id: 12 }} onNavigate={vi.fn()} />, { route: "/classes/12" });
        expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
        expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });
    it("distinguishes HTTP 404 from a permission error", async () => {
        fakeHttp.on("get", "/classes/12/readiness", () => { throw httpError(404); });
        renderAt(<ClassReadinessPanel classItem={{ id: 12 }} onNavigate={vi.fn()} />, { route: "/classes/12" });
        expect(await screen.findByRole("alert")).toHaveTextContent("Class readiness not found");
        expect(screen.queryByText("Access denied")).not.toBeInTheDocument();
    });
    it("shows blocked directory evidence and next steps without presenting it as ready", async () => {
        fakeHttp.on("get", "/classes/12/readiness", { ...readiness, ready: 0, verified: 2, unknown: 2, blocked: 1,
            checks: readiness.checks.map(check => check.key === "operations" ? { ...check, status: "BLOCKED",
                reason: "Room API is unavailable (HTTP 503).", action: "Restore the real room directory; no sample rooms can verify readiness." } : check) });
        renderAt(<ClassReadinessPanel classItem={{ id: 12, code: "CLASS_12" }} onNavigate={vi.fn()} />, { route: "/classes/12" });
        expect(await screen.findByText(/0\/2 verified checks ready, 2 unknown. 1 BLOCKED/)).toBeInTheDocument();
        expect(screen.getByText("Room API is unavailable (HTTP 503).")).toBeInTheDocument();
        expect(screen.getByText("Restore the real room directory; no sample rooms can verify readiness.")).toBeInTheDocument();
        expect(screen.getByText(/Internal ID 12/)).toBeInTheDocument();
        expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
        expect(fakeHttp.calls.every(call => call.method === "get")).toBe(true);
    });
    it("explains setup requirements and denies setup without its read permissions", async () => {
        const { user } = renderAt(<ClassReadinessPanel classItem={{ id: 12 }} onNavigate={vi.fn()} />, { route: "/classes/12" });
        expect(await screen.findByText(/Saving Class Info does not link a training program/)).toBeInTheDocument();
        expect(screen.getByText(/draft calendar versions alone do not count as sessions/)).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: "Open Class Setup" })[0]).toBeDisabled();
        await user.click(screen.getAllByRole("button", { name: "Open Class Setup" })[0]);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(fakeHttp.calls.every(call => call.method === "get")).toBe(true);
    });
});
