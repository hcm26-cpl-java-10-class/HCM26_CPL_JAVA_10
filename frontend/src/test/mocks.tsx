/**
 * Module factories shared by the page tests, used as
 *   vi.mock("@/api/axios", () => import("@/test/mocks").then((m) => m.axiosModule()));
 * The pages are exercised against a fake backend (fake-http.ts) and a controllable permission set; the layout shell
 * (sidebar, breadcrumbs, header) is existing code that is not under test here.
 */
import type { ReactNode } from "react";
import { fakeHttp } from "./fake-http";

export const permissionState = { granted: new Set<string>() };

export function grant(...permissions: string[]) {
    permissionState.granted = new Set(permissions);
}

export function axiosModule() {
    return { default: fakeHttp.axios };
}

export function permissionsModule() {
    const hasPermission = (permission: string) => permissionState.granted.has(permission);

    return {
        usePermissions: () => ({
            hasPermission,
            hasAnyPermission: (permissions: string[]) => permissions.some(hasPermission),
            hasAllPermissions: (permissions: string[]) => permissions.every(hasPermission),
            activeRole: "ADMIN",
        }),
    };
}

export function layoutModule() {
    return { MainLayout: ({ children }: { children: ReactNode }) => <div data-testid="layout">{children}</div> };
}
