import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { fakeHttp, httpError, pageOf, type RecordedCall } from "@/test/fake-http";
import { grant } from "@/test/mocks";
import { renderAt } from "@/test/render";
import { ClassSetupForm } from "./ClassSetupForm";
import ClassSetupPage from "../ClassSetupPage";
import type { ClassSetup, MainAssignment } from "@/api/features/class-setup.api";

vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));
vi.mock("@/hooks/usePermissions", () => import("@/test/mocks").then(m => m.permissionsModule()));
vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then(m => m.layoutModule()));
const rights = ["CLASS_READ", "CLASS_UPDATE", "PROGRAM_READ", "ASSIGNMENT_READ", "ASSIGNMENT_CREATE", "ASSIGNMENT_UPDATE"];
const profile = { id: 42, code: "INTERNAL_42", name: "Internal class", status: "planning", program: "REAL_JAVA", masterTrainer: "Real Trainer",
    startDate: "2030-06-01", endDate: "2030-09-01", plannedSize: 20, classAdmin: "Admin", site: "HCM" };
const program = { id: 7, code: "REAL_JAVA", name: "Real Java Curriculum", version: "2", status: "ACTIVE", isActive: true, subjects: [], totalDurationHours: 40 };
const link = { id: 5, programId: 7, code: program.code, name: program.name, version: program.version, status: "ACTIVE" as const, active: true, matchesClassProgram: true };
const subjects = [{ id: 101, subjectId: 10, code: "JAVA_SUBJECT", name: "Java Fundamentals", eligible: true }];
const trainer = { id: 90, name: "Real Trainer", email: "trainer@example.test", status: "active" };
let saved: ClassSetup;

beforeEach(() => {
    grant(...rights); fakeHttp.reset();
    saved = { classId: 42, classCode: profile.code, savedProgram: profile.program, masterTrainer: profile.masterTrainer,
        startDate: profile.startDate, endDate: profile.endDate, programLink: null, subjects: [], assignments: [] };
    fakeHttp.on("get", "/classes/42/setup", () => structuredClone(saved));
    fakeHttp.on("get", "/classes/42", profile);
    fakeHttp.on("get", "/classes", [profile]);
    fakeHttp.on("get", "/programs", pageOf([program, { ...program, id: 8, status: "INACTIVE" }, { ...program, id: 9, isActive: false }]));
    fakeHttp.on("get", "/external/trainers", [trainer]);
    fakeHttp.on("get", "/external/data-source", { sampleData: false });
    fakeHttp.on("get", "/classes/42/readiness", () => ({ classId: 42,
        ready: Number(!!saved.programLink) + Number(!!saved.assignments.length), unknown: 0, blocked: 0, verified: 5, notReady: 5, enrolledTrainees: 0, evaluatedAt: "2030-01-01T00:00:00Z",
        checks: [{ key: "basic", label: "Basic Information", status: saved.programLink ? "READY" : "UNKNOWN", reason: saved.programLink ? "Program link verified by API" : "No link", target: "setup" },
            { key: "trainer", label: "Trainer Assignment", status: saved.assignments.length ? "READY" : "UNKNOWN", reason: saved.assignments.length ? "Assignment verified by API" : "No assignment", target: "setup" }] }));
    fakeHttp.on("put", "/classes/42/program-link", () => { saved.programLink = link; saved.subjects = subjects; return link; });
    fakeHttp.on("post", "/classes/42/teaching-assignments", (call: RecordedCall) => {
        const input = call.data as MainAssignment;
        const item = { ...input, id: 11, classCode: profile.code, subjectId: 10, subjectCode: "JAVA_SUBJECT", subjectName: "Java Fundamentals", trainerName: trainer.name };
        saved.assignments = [item]; return item;
    });
    fakeHttp.on("put", "/classes/42/teaching-assignments/11", (call: RecordedCall) => {
        saved.assignments = [{ ...saved.assignments[0], ...(call.data as MainAssignment) }]; return saved.assignments[0];
    });
});
function linked() { saved.programLink = link; saved.subjects = subjects; }
async function chooseAssignment(user: ReturnType<typeof renderAt>["user"]) {
    await screen.findByLabelText("Program Subject");
    await user.selectOptions(screen.getByLabelText("Program Subject"), "101");
    await waitFor(() => expect(screen.getByLabelText("Verified Trainer")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("Verified Trainer"), "90");
}

it("links only an active catalog program to the internal class and refreshes readiness from GET", async () => {
    const { user } = renderAt(<ClassSetupForm classId={42} />, { route: "/classes/42" });
    await waitFor(() => expect(screen.getByLabelText("ACTIVE Training Program")).toBeEnabled());
    const options = within(screen.getByLabelText("ACTIVE Training Program")).getAllByRole("option");
    expect(options.map(o => o.getAttribute("value"))).toEqual(["", "7"]);
    await user.selectOptions(screen.getByLabelText("ACTIVE Training Program"), "7");
    await user.click(screen.getByRole("button", { name: "Save Program Link" }));
    expect(await screen.findByText(/Program link verified by API/)).toBeInTheDocument();
    expect(fakeHttp.callsTo("put", "/classes/42/program-link")[0].data).toEqual({ programId: 7 });
    expect(saved.assignments).toHaveLength(0);
    expect(fakeHttp.callsTo("get", "/classes/42/readiness").length).toBeGreaterThan(1);
    expect(fakeHttp.calls.some(call => call.url.includes("/external/classes"))).toBe(false);
});

it("creates and updates MAIN with class dates, and reloads saved assignments through the API", async () => {
    linked();
    const view = renderAt(<ClassSetupForm classId={42} />, { route: "/classes/42" });
    await chooseAssignment(view.user);
    expect(screen.getByLabelText("Effective From")).toHaveValue("2030-06-01");
    await view.user.click(screen.getByRole("button", { name: "Create MAIN Assignment" }));
    expect(await screen.findByText(/Assignment verified by API/)).toBeInTheDocument();
    expect(fakeHttp.callsTo("post", "/classes/42/teaching-assignments")[0].data).toEqual({ classId: 42, programSubjectId: 101, trainerId: 90, role: "MAIN", effectiveFrom: "2030-06-01", effectiveTo: "2030-09-01" });
    await view.user.click(await screen.findByRole("button", { name: "Edit assignment 11" }));
    fireEvent.change(screen.getByLabelText("Effective From"), { target: { value: "2030-05-30" } });
    fireEvent.change(screen.getByLabelText("Effective To (blank = open-ended)"), { target: { value: "" } });
    await view.user.click(screen.getByRole("button", { name: "Update MAIN Assignment" }));
    await waitFor(() => expect(fakeHttp.callsTo("put", "/classes/42/teaching-assignments/11")).toHaveLength(1));
    expect(saved.assignments).toHaveLength(1);
    expect(saved.assignments[0].effectiveTo).toBeNull();
    view.unmount();
    renderAt(<ClassSetupForm classId={42} />, { route: "/classes/42" });
    expect(await screen.findByRole("button", { name: "Edit assignment 11" })).toBeInTheDocument();
    expect(screen.getByText(/2030-05-30 – Open-ended/)).toBeInTheDocument();
});

it("prevents incomplete date coverage without sending an assignment", async () => {
    linked(); const { user } = renderAt(<ClassSetupForm classId={42} />, { route: "/" });
    await chooseAssignment(user);
    fireEvent.change(screen.getByLabelText("Effective From"), { target: { value: "2030-06-02" } });
    await user.click(screen.getByRole("button", { name: "Create MAIN Assignment" }));
    expect(await screen.findByText(/MAIN assignment must cover the entire class date range/)).toBeInTheDocument();
    expect(fakeHttp.callsTo("post", "/classes/42/teaching-assignments")).toHaveLength(0);
});

it("reports DOTNET/Java mismatch without automatically changing Class Info", async () => {
    saved.savedProgram = "FR_NFP_DOTNET";
    const { user } = renderAt(<ClassSetupForm classId={42} />, { route: "/" });
    await waitFor(() => expect(screen.getByLabelText("ACTIVE Training Program")).toBeEnabled());
    await user.selectOptions(screen.getByLabelText("ACTIVE Training Program"), "7");
    expect(screen.getByText(/Saved Program “FR_NFP_DOTNET” does not match “REAL_JAVA”/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Program Link" })).toBeDisabled();
    expect(fakeHttp.calls.every(c => c.method === "get")).toBe(true);
});

it.each(["sample", "unreachable"])("blocks %s Trainer API without sample fallback or an enabled save", async kind => {
    linked();
    if (kind === "sample") fakeHttp.on("get", "/external/data-source", { sampleData: true });
    else fakeHttp.on("get", "/external/trainers", () => { throw httpError(503, { message: "Master unavailable" }); });
    renderAt(<ClassSetupForm classId={42} />, { route: "/" });
    expect(await screen.findByText(/BLOCKED: Real Master Trainer directory could not be verified/)).toBeInTheDocument();
    expect(screen.getByLabelText("Verified Trainer")).toBeDisabled();
    expect(within(screen.getByLabelText("Verified Trainer")).getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Create MAIN Assignment" })).toBeDisabled();
    expect(fakeHttp.calls.every(c => c.method === "get")).toBe(true);
});

it("does not display successful readiness when the backend rejects a duplicate", async () => {
    linked(); fakeHttp.on("post", "/classes/42/teaching-assignments", () => { throw httpError(409, { message: "Overlapping MAIN assignment" }); });
    const { user } = renderAt(<ClassSetupForm classId={42} />, { route: "/" });
    await chooseAssignment(user); await user.click(screen.getByRole("button", { name: "Create MAIN Assignment" }));
    expect(await screen.findByText("Overlapping MAIN assignment")).toBeInTheDocument();
    expect(screen.queryByText(/MAIN assignment saved/)).not.toBeInTheDocument();
    expect(saved.assignments).toHaveLength(0);
});

it("honors read and write permissions without forbidden API calls", async () => {
    grant("CLASS_READ");
    const view = renderAt(<ClassSetupForm classId={42} />, { route: "/" });
    expect(screen.getByRole("alert")).toHaveTextContent("Access denied");
    expect(fakeHttp.calls).toHaveLength(0);
    view.unmount();
    grant("CLASS_READ", "PROGRAM_READ", "ASSIGNMENT_READ");
    renderAt(<ClassSetupForm classId={42} />, { route: "/" });
    expect(await screen.findByRole("button", { name: "Save Program Link" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Create MAIN Assignment" })).toBeDisabled();
});

it("opens standalone Class Setup with a picker backed by internal classes", async () => {
    renderAt(<ClassSetupPage />, { route: "/class-setup?classId=42" });
    expect(await screen.findByText(/Internal Class ID 42/)).toBeInTheDocument();
    expect(screen.getByLabelText("Internal Class")).toHaveValue("42");
    expect(fakeHttp.callsTo("get", "/classes").length).toBeGreaterThan(0);
    expect(fakeHttp.calls.some(c => c.url.includes("/external/classes"))).toBe(false);
});
