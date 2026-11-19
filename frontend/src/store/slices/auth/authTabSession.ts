import type { AuthState, LoginResponse } from "@/types/features/auth";

const AUTH_REQUEST = "fams:auth-request";
const AUTH_RESPONSE = "fams:auth-response";

type AuthResponseMessage = {
    type: typeof AUTH_RESPONSE;
    session: LoginResponse;
};

function isMessage(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object";
}

function isLoginResponse(value: unknown): value is LoginResponse {
    if (!value || typeof value !== "object") return false;

    const session = value as Partial<LoginResponse>;
    return typeof session.token === "string"
        && session.token.length > 0
        && typeof session.email === "string"
        && typeof session.firstName === "string"
        && typeof session.lastName === "string"
        && typeof session.role === "string"
        && Array.isArray(session.roles)
        && session.roles.every((role) => typeof role === "string")
        && Array.isArray(session.permissions)
        && session.permissions.every((permission) => typeof permission === "string")
        && !!session.rolePermissions
        && typeof session.rolePermissions === "object"
        && !Array.isArray(session.rolePermissions)
        && Object.values(session.rolePermissions).every(
            (permissions) => Array.isArray(permissions)
                && permissions.every((permission) => typeof permission === "string"),
        );
}

function toLoginResponse(auth: AuthState): LoginResponse {
    return {
        token: auth.token,
        email: auth.email,
        firstName: auth.firstName,
        lastName: auth.lastName,
        role: auth.role,
        roles: auth.roles,
        permissions: auth.permissions,
        rolePermissions: auth.rolePermissions,
    };
}

export function installAuthTabSessionBridge(
    getAuthState: () => AuthState,
    acceptSession: (session: LoginResponse) => void,
    markAuthInitialized: () => void,
    currentWindow: Window = window,
) {
    currentWindow.addEventListener("message", (event: MessageEvent<unknown>) => {
        if (event.origin !== currentWindow.location.origin || !event.source) return;
        if (!isMessage(event.data) || event.data.type !== AUTH_REQUEST) return;

        const auth = getAuthState();
        if (!auth.isAuthenticated || !auth.token) return;

        const response: AuthResponseMessage = {
            type: AUTH_RESPONSE,
            session: toLoginResponse(auth),
        };
        (
            event.source as {
                postMessage: (
                    message: AuthResponseMessage,
                    options: { targetOrigin: string },
                ) => void;
            }
        ).postMessage(response, { targetOrigin: event.origin });
    });

    const navigationType = currentWindow.performance.getEntriesByType("navigation")
        .map((entry) => (entry as PerformanceNavigationTiming).type)[0];
    const opener = currentWindow.opener;
    if (!opener || navigationType === "reload") {
        markAuthInitialized();
        return;
    }

    let timeoutId: number;
    const handleAuthResponse = (event: MessageEvent<unknown>) => {
        if (event.source !== opener || event.origin !== currentWindow.location.origin) return;
        if (!isMessage(event.data) || event.data.type !== AUTH_RESPONSE) return;

        const session = (event.data as Partial<AuthResponseMessage>).session;
        if (!isLoginResponse(session)) return;

        currentWindow.removeEventListener("message", handleAuthResponse);
        currentWindow.clearTimeout(timeoutId);
        acceptSession(session);
        markAuthInitialized();
    };

    currentWindow.addEventListener("message", handleAuthResponse);
    timeoutId = currentWindow.setTimeout(
        () => {
            currentWindow.removeEventListener("message", handleAuthResponse);
            markAuthInitialized();
        },
        10_000,
    );
    opener.postMessage(
        { type: AUTH_REQUEST },
        { targetOrigin: currentWindow.location.origin },
    );
}
