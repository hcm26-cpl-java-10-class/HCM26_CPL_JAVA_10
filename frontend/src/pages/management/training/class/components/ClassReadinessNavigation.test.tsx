import { configureStore } from "@reduxjs/toolkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import type { ClassReadiness } from "@/api/features/cls.api";
import authReducer from "@/store/slices/auth/authSlice";
import { fakeHttp, httpError } from "@/test/fake-http";
import { createTestQueryClient } from "@/test/render";

const menuState = vi.hoisted(() => ({ hideClasses: false }));
vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));
vi.mock("@/components/layout/MainLayout", () => import("@/test/mocks").then(m => m.layoutModule()));
// Menu transport is isolated; AppRoutes, the registry, ProtectedRoute and RBAC run unchanged.
vi.mock("@/hooks/useSidebarMenus", () => ({
    useActiveModuleGroups: () => ({
        data: menuState.hideClasses ? [] : [{ id: "training", modules: [{ id: "classes", url: "/classes", requiredPermission: "SESSION_READ" }] }],
        isLoading: false, isError: false, refetch: vi.fn(),
    }),
}));

const permissions = ["CLASS_READ", "CLASS_UPDATE", "SESSION_READ", "ENROLLMENT_READ"];
const pageState = { listSearch: "q=NAV&status=planning&page=2", source: "readiness" };
const classItem = (id: number) => ({
    id, code: `NAV_${id}`, name: `Navigation class ${id}`, status: "planning", traineeSource: "internal",
    startDate: "2026-11-14", endDate: "2027-01-13", plannedSize: 25, program: "FULLSTACK_JAVA",
    classAdmin: "admin@example.com", masterTrainer: "teacher@example.com", site: "HCM",
});
const readiness = (id: number): ClassReadiness => ({
    classId: id, ready: 0, verified: 3, unknown: 2, notReady: 3, enrolledTrainees: 0, evaluatedAt: "2026-11-07T01:00:00Z",
    checks: [
        { key: "basic", label: "Basic Information", status: "UNKNOWN", reason: "Program link unverified", target: "setup" },
        { key: "trainer", label: "Trainer Assignment", status: "UNKNOWN", reason: "Assignment unverified", target: "setup" },
        { key: "enrollment", label: "Trainee Enrollment", status: "NOT_READY", reason: "No trainees", target: "trainees" },
        { key: "calendar", label: "Calendar Readiness", status: "NOT_READY", reason: "No sessions", target: "calendar" },
        { key: "operations", label: "Operational Information", status: "NOT_READY", reason: "Location required", target: "edit" },
    ],
});

function renderApp(path = "/classes/42?tab=info&source=readiness#checks", granted = permissions) {
    window.history.replaceState({ usr: pageState, key: "test", idx: 0 }, "", path);
    const store = configureStore({
        reducer: { auth: authReducer },
        preloadedState: { auth: {
            ...authReducer(undefined, { type: "init" }), isAuthenticated: true, token: "test-token",
            role: "ADMIN", roles: ["ADMIN"], permissions: granted, rolePermissions: { ADMIN: granted },
        } },
    });
    const user = userEvent.setup();
    render(<Provider store={store}><QueryClientProvider client={createTestQueryClient()}><App /></QueryClientProvider></Provider>);
    return { user };
}

beforeEach(() => {
    fakeHttp.reset();
    menuState.hideClasses = false;
    localStorage.clear();
    fakeHttp.on("get", "/classes", [classItem(42), classItem(87)]);
    fakeHttp.on("get", "/classes/stats", { totalClasses: 2, inProgress: 0, upcomingClasses: 2, completedClasses: 0,
        asOf: "2026-11-07", upcomingThrough: "2026-12-07", timezone: "Asia/Ho_Chi_Minh" });
    for (const id of [42, 87]) {
        fakeHttp.on("get", `/classes/${id}`, classItem(id));
        fakeHttp.on("get", `/classes/${id}/readiness`, readiness(id));
        fakeHttp.on("get", `/classes/${id}/trainees`, []);
        fakeHttp.on("get", `/external/classes/${id}/calendars`, []);
    }
});

describe("Readiness navigation through the application router and RBAC", () => {
    it.each([0, 1])("keeps Class Details open and explains unavailable setup action %s", async (index) => {
        const { user } = renderApp();
        const buttons = await screen.findAllByRole("button", { name: "Open Class Setup" });
        await user.click(buttons[index]);
        expect(screen.getByRole("status")).toHaveTextContent("Class Setup is not available in this application");
        expect(window.location.pathname + window.location.search + window.location.hash).toBe("/classes/42?tab=info&source=readiness#checks");
        expect(screen.getAllByRole("tab")).toHaveLength(5);
        expect(fakeHttp.calls.every(call => call.method === "get")).toBe(true);
    });

    it.each([
        ["/classes/42", 42, "Open Trainee List", "trainees", "Trainee List"],
        ["/classes/42", 42, "Open Calendar", "calendar", "Calendar"],
        ["/class-details/87", 87, "Open Trainee List", "trainees", "Trainee List"],
        ["/class-details/87", 87, "Open Calendar", "calendar", "Calendar"],
        ["/training-operations/class-details/NAV_42", 42, "Open Trainee List", "trainees", "Trainee List"],
        ["/training-operations/class-details/NAV_42", 42, "Open Calendar", "calendar", "Calendar"],
    ] as const)("%s: %s %s stays on the current class", async (path, id, button, tab, label) => {
        const { user } = renderApp(`${path}?tab=info&source=readiness#checks`);
        await user.click(await screen.findByRole("button", { name: button }));
        expect(screen.getByRole("tab", { name: label })).toHaveAttribute("data-state", "active");
        expect(window.location.pathname).toBe(path);
        expect(new URLSearchParams(window.location.search).get("tab")).toBe(tab);
        expect(new URLSearchParams(window.location.search).get("source")).toBe("readiness");
        expect(window.location.hash).toBe("#checks");
        expect(window.history.state.usr).toEqual(pageState);
        const heading = screen.getByRole("heading", { name: `Class Details : NAV_${id}` });
        expect(heading).toBeInTheDocument();
        expect(within(heading.closest("header")!).getByRole("link", { name: "Back to Class List" })).toHaveAttribute("href", `/classes?${pageState.listSearch}`);
        expect(screen.getAllByRole("tab")).toHaveLength(5);
        await waitFor(() => expect(fakeHttp.callsTo("get", tab === "trainees" ? `/classes/${id}/trainees` : `/external/classes/${id}/calendars`)).toHaveLength(1));
    });

    it("opens the existing edit modal prefilled for this class without navigating or writing", async () => {
        const { user } = renderApp();
        await user.click(await screen.findByRole("button", { name: "Edit Class Info" }));
        const dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByLabelText(/Class Code/)).toHaveValue("NAV_42");
        expect(within(dialog).getByLabelText(/Class Name/)).toHaveValue("Navigation class 42");
        expect(window.location.pathname + window.location.search).toBe("/classes/42?tab=info&source=readiness");
        expect(fakeHttp.calls.every(call => call.method === "get")).toBe(true);
    });

    it("disables edit when CLASS_UPDATE is missing and keeps the page accessible", async () => {
        const { user } = renderApp(undefined, permissions.filter(p => p !== "CLASS_UPDATE"));
        const button = await screen.findByRole("button", { name: "Edit Class Info" });
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute("title", "You do not have permission to edit class information.");
        await user.click(button);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(window.location.pathname).toBe("/classes/42");
    });

    it("shows trainee permission denial in the current tab without 404 or a forbidden API request", async () => {
        const { user } = renderApp(undefined, permissions.filter(p => p !== "ENROLLMENT_READ"));
        await user.click(await screen.findByRole("button", { name: "Open Trainee List" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission to view trainee profiles");
        expect(window.location.pathname).toBe("/classes/42");
        expect(fakeHttp.callsTo("get", "/classes/42/trainees")).toHaveLength(0);
    });

    it("shows a calendar API 403 as Access denied in the current tab", async () => {
        fakeHttp.on("get", "/external/classes/42/calendars", () => { throw httpError(403); });
        const { user } = renderApp();
        await user.click(await screen.findByRole("button", { name: "Open Calendar" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Access denied");
        expect(window.location.pathname).toBe("/classes/42");
        expect(new URLSearchParams(window.location.search).get("tab")).toBe("calendar");
    });

    it("keeps the unsaved-changes guard and URL state when leaving a readiness calendar", async () => {
        fakeHttp.on("get", "/external/classes/42/calendars", [{
            id: 100, classId: 42, name: "Navigation calendar", version: "1.0", historyChange: "Initial",
            lastModifiedDate: "2026-11-07T09:00:00", lastModifiedBy: "Admin", status: "active",
        }]);
        const { user } = renderApp(undefined, [...permissions, "SESSION_UPDATE"]);
        await user.click(await screen.findByRole("button", { name: "Open Calendar" }));
        await user.click(await screen.findByRole("button", { name: "Edit calendar version 1.0" }));
        await user.type(screen.getByLabelText("Calendar name for version 1.0"), "_draft");
        await user.click(screen.getByRole("tab", { name: "Class Info" }));
        await user.click(within(await screen.findByRole("dialog", { name: "Unsaved Changes" })).getByRole("button", { name: "Stay" }));
        expect(screen.getByLabelText("Calendar name for version 1.0")).toHaveValue("Navigation calendar_draft");
        expect(new URLSearchParams(window.location.search).get("tab")).toBe("calendar");
        await user.click(screen.getByRole("tab", { name: "Class Info" }));
        await user.click(within(await screen.findByRole("dialog", { name: "Unsaved Changes" })).getByRole("button", { name: "Leave" }));
        expect(screen.getByRole("tab", { name: "Class Info" })).toHaveAttribute("data-state", "active");
        expect(window.location.pathname + window.location.search + window.location.hash).toBe("/classes/42?tab=info&source=readiness#checks");
        expect(window.history.state.usr).toEqual(pageState);
        expect(fakeHttp.calls.every(call => call.method === "get")).toBe(true);
    });

    it.each(["/classes", "/classes/42", "/class-details/87", "/training-operations/class-details/NAV_42"])(
        "routes %s to the existing 403 page when its route permission is missing", async (path) => {
            renderApp(path, ["CLASS_READ"]);
            expect(await screen.findByRole("heading", { name: "403" })).toBeInTheDocument();
            expect(window.location.pathname).toBe("/unauthorized");
            expect(fakeHttp.callsTo("get", "/classes/42")).toHaveLength(0);
        });

    it("keeps genuine missing routes as 404", async () => {
        renderApp("/missing-readiness-route");
        expect(await screen.findByRole("heading", { name: "404" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/not-found-page");
    });

    it("treats a known Class List route omitted from the permitted menu as 403", async () => {
        menuState.hideClasses = true;
        renderApp("/classes", ["CLASS_READ"]);
        expect(await screen.findByRole("heading", { name: "403" })).toBeInTheDocument();
        expect(window.location.pathname).toBe("/unauthorized");
    });

    it("returns from a readiness tab to Class List with the original filters", async () => {
        const { user } = renderApp();
        await user.click(await screen.findByRole("button", { name: "Open Trainee List" }));
        await user.click(screen.getByRole("link", { name: "Back to Class List" }));
        expect(window.location.pathname).toBe("/classes");
        expect(window.location.search).toBe(`?${pageState.listSearch}`);
        expect(await screen.findByRole("textbox", { name: "Search classes" })).toHaveValue("NAV");
    });
});
