import { configureStore } from "@reduxjs/toolkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { beforeEach, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import App from "@/App";
import authReducer from "@/store/slices/auth/authSlice";
import { fakeHttp, httpError, pageOf } from "@/test/fake-http";
import { createTestQueryClient } from "@/test/render";
import { resolveMenuPermission } from "./menu-permission.utils";

const menuState = vi.hoisted(() => ({ hide: false, error: false }));
vi.mock("@/api/axios", () => import("@/test/mocks").then(m => m.axiosModule()));
vi.mock("@/hooks/useSidebarMenus", () => ({ useActiveModuleGroups: () => ({
    data: menuState.hide ? [] : [
        { id: 1, name: "Training Management", modules: [
            { id: 1, title: "Training Programs", url: "/programs", requiredPermission: "PROGRAM_READ" },
            { id: 2, title: "Kế hoạch môn học lớp", url: "/class-setup", requiredPermission: "CLASS_READ" }] },
        { id: 2, name: "Subject Management", modules: [{ id: 3, title: "Subjects", url: "/subjects", requiredPermission: "SUBJECT_READ" }] },
        { id: 3, name: "Training Operations", modules: [{ id: 4, title: "Class List", url: "/classes", requiredPermission: "SESSION_READ" }] },
        { id: 4, name: "System Management", modules: [
            { id: 5, title: "Modules", url: "/menus", requiredPermission: "USER_READ" },
            { id: 6, title: "Module Groups", url: "/menu-groups", requiredPermission: "USER_READ" }] },
    ], isLoading: false, isError: menuState.error, error: menuState.error ? httpError(500) : null, refetch: vi.fn(),
}) }));
// Exercise the real Sidebar, links, registry, pages, AppRoutes and ProtectedRoute together.
vi.mock("@/components/layout/MainLayout", async () => {
    const { SidebarMenu } = await import("@/components/layout/Sidebar");
    const { SidebarProvider } = await import("@/components/ui/sidebar");
    return { MainLayout: ({ children }: { children: ReactNode }) => <SidebarProvider><SidebarMenu /><main>{children}</main></SidebarProvider> };
});

const rights = ["USER_READ", "MENU_READ", "CLASS_READ", "CLASS_UPDATE", "SESSION_READ", "PROGRAM_READ", "SUBJECT_READ", "ASSIGNMENT_READ", "ENROLLMENT_READ"];
const cls = { id: 4, code: "INTERNAL_4", name: "Internal test class", traineeSource: "internal", status: "planning", program: "PROGRAM_4",
    startDate: "2030-06-01", endDate: "2030-09-01", plannedSize: 20, site: "HCM", classAdmin: "Admin", masterTrainer: "Trainer" };
beforeEach(() => {
    fakeHttp.reset(); menuState.hide = false; menuState.error = false;
    fakeHttp.on("get", /.*/, pageOf([]));
    fakeHttp.on("get", "/programs/regions", []);
    fakeHttp.on("get", "/classes", pageOf([cls]));
    fakeHttp.on("get", "/classes/4", cls);
    fakeHttp.on("get", "/classes/stats", { totalClasses: 1, inProgress: 0, upcomingClasses: 1, completedClasses: 0,
        asOf: "2030-01-01", upcomingThrough: "2030-02-01", timezone: "Asia/Ho_Chi_Minh" });
    fakeHttp.on("get", "/classes/4/readiness", { classId: 4, ready: 0, verified: 0, unknown: 0, blocked: 0, notReady: 0,
        checks: [], enrolledTrainees: 0, evaluatedAt: "2030-01-01T00:00:00Z" });
    fakeHttp.on("get", "/classes/4/setup", { classId: 4, classCode: cls.code, savedProgram: cls.program, masterTrainer: cls.masterTrainer,
        startDate: cls.startDate, endDate: cls.endDate, programLink: null, subjects: [], assignments: [] });
    fakeHttp.on("get", "/external/trainers", []);
    fakeHttp.on("get", "/external/audits", []);
    fakeHttp.on("get", "/external/data-source", { sampleData: true });
});
function renderApp(path: string, permissions = rights) {
    window.history.replaceState({}, "", path);
    const store = configureStore({ reducer: { auth: authReducer }, preloadedState: { auth: {
        ...authReducer(undefined, { type: "init" }), isAuthenticated: true, token: "test", role: "ADMIN", roles: ["ADMIN"],
        permissions, rolePermissions: { ADMIN: permissions },
    } } });
    const user = userEvent.setup();
    const view = render(<Provider store={store}><QueryClientProvider client={createTestQueryClient()}><App /></QueryClientProvider></Provider>);
    return { ...view, user };
}

it.each([
    ["/programs", "Training Programs"], ["/subjects", "Subjects"], ["/class-setup", "Kế hoạch môn học lớp"],
    ["/class-setup?classId=4", "Kế hoạch môn học lớp"], ["/classes", "Class List"], ["/classes/4?tab=info", "Class List"],
    ["/menus", "Modules"], ["/menu-groups", "Module Groups"],
    ["/training/audit", "Audit"], ["/training/content", "Content"],
])("direct entry and refresh of %s renders the actual registered page instead of 404", async (path, label) => {
    const first = renderApp(path);
    expect(await screen.findByRole("link", { name: label })).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe(path);
    expect(screen.queryByText("Page Not Found")).not.toBeInTheDocument();
    first.unmount();
    renderApp(path);
    expect(await screen.findByRole("link", { name: label })).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe(path);
    expect(fakeHttp.calls.every(c => c.method === "get")).toBe(true);
});

it("navigates via the real Sidebar from Programs to Class Setup with the same registered component", async () => {
    const { user } = renderApp("/programs");
    await user.click(await screen.findByRole("link", { name: "Kế hoạch môn học lớp" }));
    expect(await screen.findByRole("heading", { name: "Class Setup" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/class-setup");
    expect(fakeHttp.calls.every(c => c.method === "get")).toBe(true);
});

it.each(["/programs", "/subjects", "/class-setup", "/menus", "/menu-groups"])("missing permissions at %s produce 403 rather than 404", async path => {
    renderApp(path, []);
    expect(await screen.findByRole("heading", { name: "403" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/unauthorized");
    expect(fakeHttp.calls).toHaveLength(0);
});

it("legacy USER_READ metadata never grants access to MENU-protected pages", async () => {
    renderApp("/menus", ["USER_READ"]);
    expect(await screen.findByRole("heading", { name: "403" })).toBeInTheDocument();
    expect(fakeHttp.callsTo("get", "/modules")).toHaveLength(0);
    expect(resolveMenuPermission("/menus", "USER_READ")).toBe("MENU_READ");
    expect(resolveMenuPermission("/menu-groups", "USER_READ")).toBe("MENU_READ");
    expect(resolveMenuPermission("/classes", "SESSION_READ")).toBe("SESSION_READ");
});

it.each([403, 404, 500])("Class Setup API HTTP %s stays on the valid route and displays the API error", async status => {
    fakeHttp.on("get", "/classes/4/setup", () => { throw httpError(status); });
    renderApp("/class-setup?classId=4");
    expect(await screen.findByText(`HTTP ${status}`)).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe("/class-setup?classId=4");
    expect(screen.queryByText("Page Not Found")).not.toBeInTheDocument();
});

it("an unavailable menu remains an API error rather than a fake missing page", async () => {
    menuState.hide = true; menuState.error = true;
    renderApp("/classes");
    expect(await screen.findByRole("alert")).toHaveTextContent("Server error");
    expect(window.location.pathname).toBe("/classes");
});

it("a valid class details URL retains exactly five FAMS tabs", async () => {
    renderApp("/classes/4?tab=info");
    await screen.findByRole("tab", { name: "Class Info" });
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    await waitFor(() => expect(window.location.pathname).toBe("/classes/4"));
});

it("opens existing Session Management from Calendar without needing a separate sidebar module", async () => {
    fakeHttp.on("get", "/external/classes/4", { id: 4, code: "WRONG_SHARED_CLASS" });
    renderApp("/sessions?classId=4");
    expect(await screen.findByText("Showing the sessions of class")).toBeInTheDocument();
    expect(window.location.pathname + window.location.search).toBe("/sessions?classId=4");
    await waitFor(() => expect(fakeHttp.callsTo("get", "/sessions").length).toBeGreaterThan(0));
    expect(await screen.findByRole("link", { name: /INTERNAL_4/ })).toBeInTheDocument();
    expect(screen.queryByText("WRONG_SHARED_CLASS")).not.toBeInTheDocument();
    expect(fakeHttp.calls.some(c => c.url.includes("/external/classes"))).toBe(false);
});
