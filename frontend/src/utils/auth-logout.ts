import { authApi } from "@/api/features/auth.api";
import { setLogout } from "@/store/slices/auth/authSlice";
import type { Dispatch } from "@reduxjs/toolkit";
import type { QueryClient } from "@tanstack/react-query";

const LOGOUT_CHANNEL_NAME = "fams:auth-logout";
const LOGOUT_STORAGE_EVENT_KEY = "fams:auth-logout-ts";

export function broadcastCrossTabLogout() {
    try {
        if (typeof BroadcastChannel !== "undefined") {
            const channel = new BroadcastChannel(LOGOUT_CHANNEL_NAME);
            channel.postMessage({ type: "LOGOUT", ts: Date.now() });
            channel.close();
        }
    } catch {
        // Ignore if BroadcastChannel is unavailable.
    }
    try {
        localStorage.setItem(LOGOUT_STORAGE_EVENT_KEY, String(Date.now()));
    } catch {
        // Ignore if storage is disabled.
    }
}

export function installCrossTabLogoutListener(onRemoteLogout: () => void): () => void {
    let channel: BroadcastChannel | null = null;
    try {
        if (typeof BroadcastChannel !== "undefined") {
            channel = new BroadcastChannel(LOGOUT_CHANNEL_NAME);
            channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
                if (event.data?.type === "LOGOUT") {
                    onRemoteLogout();
                }
            };
        }
    } catch {
        channel = null;
    }

    const onStorage = (event: StorageEvent) => {
        if (event.key === LOGOUT_STORAGE_EVENT_KEY && event.newValue) {
            onRemoteLogout();
        }
    };
    window.addEventListener("storage", onStorage);

    return () => {
        window.removeEventListener("storage", onStorage);
        if (channel) {
            channel.close();
        }
    };
}

export interface PerformAppLogoutOptions {
    dispatch: Dispatch;
    queryClient?: QueryClient;
    navigate?: (to: string, options?: { replace?: boolean }) => void;
    clearViewRole?: () => void;
    skipApi?: boolean;
    broadcast?: boolean;
}

export async function performAppLogout({
    dispatch,
    queryClient,
    navigate,
    clearViewRole,
    skipApi = false,
    broadcast = true,
}: PerformAppLogoutOptions): Promise<void> {
    try {
        if (!skipApi) {
            await authApi.logout();
        }
    } catch {
        // Always complete local logout even if network/server fails.
    } finally {
        clearViewRole?.();
        queryClient?.clear();
        dispatch(setLogout());
        if (broadcast) {
            broadcastCrossTabLogout();
        }
        if (navigate) {
            navigate("/login", { replace: true });
        }
    }
}
