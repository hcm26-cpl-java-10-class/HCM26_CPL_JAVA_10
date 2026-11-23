// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const authSession = {
    token: "teacher-token",
    email: "teacher@example.com",
    firstName: "Course",
    lastName: "Teacher",
    role: "TEACHER",
    roles: ["TEACHER"],
    permissions: ["EXAM_UPDATE"],
    rolePermissions: { TEACHER: ["EXAM_UPDATE"] },
};

describe("tab-scoped authentication", () => {
    beforeEach(() => {
        vi.resetModules();
        sessionStorage.clear();
        localStorage.clear();
        vi.restoreAllMocks();
        Object.defineProperty(window, "opener", { configurable: true, value: null });
        vi.spyOn(performance, "getEntriesByType").mockReturnValue([]);
    });

    it("starts unauthenticated after a page reload and does not persist the token", async () => {
        localStorage.setItem("token", "legacy-token");

        const { default: authReducer, setLogin } = await import("./authSlice");
        const loggedIn = authReducer(undefined, setLogin(authSession));

        expect(loggedIn.isAuthenticated).toBe(true);
        expect(sessionStorage.getItem("fams.auth.tab")).toBeNull();
        expect(localStorage.getItem("token")).toBeNull();

        const reloaded = authReducer(undefined, { type: "test/reload" });
        expect(reloaded.isAuthenticated).toBe(false);
        expect(reloaded.token).toBe("");
    });

    it("requests a session from its opener on a new-tab navigation", async () => {
        const opener = { postMessage: vi.fn() };
        Object.defineProperty(window, "opener", { configurable: true, value: opener });

        const { installAuthTabSessionBridge } = await import("./authTabSession");
        const acceptSession = vi.fn();
        const markAuthInitialized = vi.fn();
        installAuthTabSessionBridge(
            () => ({ ...authSession, isAuthenticated: false, isAuthInitialized: false }),
            acceptSession,
            markAuthInitialized,
        );

        expect(opener.postMessage).toHaveBeenCalledWith(
            { type: "fams:auth-request" },
            { targetOrigin: window.location.origin },
        );
        expect(markAuthInitialized).not.toHaveBeenCalled();
    });

    it("restores only a valid same-origin session response from the opener", async () => {
        const opener = { postMessage: vi.fn() };
        Object.defineProperty(window, "opener", { configurable: true, value: opener });

        const { installAuthTabSessionBridge } = await import("./authTabSession");
        const acceptSession = vi.fn();
        const markAuthInitialized = vi.fn();
        installAuthTabSessionBridge(
            () => ({ ...authSession, isAuthenticated: false, isAuthInitialized: false }),
            acceptSession,
            markAuthInitialized,
        );
        expect(markAuthInitialized).not.toHaveBeenCalled();

        window.dispatchEvent(new MessageEvent("message", {
            data: { type: "fams:auth-response", session: authSession },
            origin: window.location.origin,
            source: opener as unknown as Window,
        }));
        expect(acceptSession).toHaveBeenCalledWith(authSession);
        expect(markAuthInitialized).toHaveBeenCalledOnce();

        acceptSession.mockClear();
        window.dispatchEvent(new MessageEvent("message", {
            data: { type: "fams:auth-response", session: authSession },
            origin: "https://untrusted.example",
            source: opener as unknown as Window,
        }));
        expect(acceptSession).not.toHaveBeenCalled();
    });

    it("sends the in-memory session only to a same-origin tab requesting it", async () => {
        Object.defineProperty(window, "opener", { configurable: true, value: null });
        const requestingTab = { postMessage: vi.fn() };

        const { installAuthTabSessionBridge } = await import("./authTabSession");
        installAuthTabSessionBridge(
            () => ({ ...authSession, isAuthenticated: true, isAuthInitialized: true }),
            vi.fn(),
            vi.fn(),
        );

        window.dispatchEvent(new MessageEvent("message", {
            data: { type: "fams:auth-request" },
            origin: window.location.origin,
            source: requestingTab as unknown as Window,
        }));

        expect(requestingTab.postMessage).toHaveBeenCalledWith(
            { type: "fams:auth-response", session: authSession },
            { targetOrigin: window.location.origin },
        );
    });

    it("does not request auth from opener on reload", async () => {
        const opener = { postMessage: vi.fn() };
        Object.defineProperty(window, "opener", { configurable: true, value: opener });
        vi.spyOn(performance, "getEntriesByType").mockReturnValue([
            { type: "reload" } as PerformanceNavigationTiming,
        ]);

        const { installAuthTabSessionBridge } = await import("./authTabSession");
        const markAuthInitialized = vi.fn();
        installAuthTabSessionBridge(
            () => ({ ...authSession, isAuthenticated: true, isAuthInitialized: true }),
            vi.fn(),
            markAuthInitialized,
        );

        expect(opener.postMessage).not.toHaveBeenCalled();
        expect(markAuthInitialized).toHaveBeenCalledOnce();
    });
});
