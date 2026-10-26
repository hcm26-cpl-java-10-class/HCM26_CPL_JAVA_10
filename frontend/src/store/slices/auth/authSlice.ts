import type { AuthState, LoginResponse } from "@/types/features/auth";
import { normalizeAuthRolePayload } from "@/utils/rbac.utils";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

const AUTH_STORAGE_KEYS = [
    "token",
    "email",
    "firstName",
    "lastName",
    "role",
    "roles",
    "permissions",
    "rolePermissions",
];

const parseStringArrayFromStorage = (key: string): string[] => {
    const rawValue = localStorage.getItem(key);
    if (!rawValue) {
        return [];
    }

    try {
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) {
            return [];
        }

        return parsed.filter((item): item is string => typeof item === "string");
    } catch {
        return [];
    }
};

const parseRolePermissionsFromStorage = (): Record<string, string[]> => {
    const rawRolePermissions = localStorage.getItem("rolePermissions");
    if (!rawRolePermissions) {
        return {};
    }

    try {
        const parsed = JSON.parse(rawRolePermissions);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }

        return Object.entries(parsed).reduce<Record<string, string[]>>((acc, [role, permissions]) => {
            if (!Array.isArray(permissions)) {
                return acc;
            }

            acc[role] = permissions.filter((item): item is string => typeof item === "string");
            return acc;
        }, {});
    } catch {
        return {};
    }
};

const clearAuthStorage = () => {
    AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
};

const initialAuthData = normalizeAuthRolePayload({
    role: localStorage.getItem("role") || "",
    roles: parseStringArrayFromStorage("roles"),
    permissions: parseStringArrayFromStorage("permissions"),
    rolePermissions: parseRolePermissionsFromStorage(),
});

const initialState: AuthState = {
    token: localStorage.getItem("token") || "",
    email: localStorage.getItem("email") || "",
    firstName: localStorage.getItem("firstName") || "",
    lastName: localStorage.getItem("lastName") || "",
    role: initialAuthData.role,
    roles: initialAuthData.roles,
    permissions: initialAuthData.permissions,
    rolePermissions: initialAuthData.rolePermissions,
    isAuthenticated: !!localStorage.getItem("token"),
};

const authSlice = createSlice({
    name: "auth",
    initialState,
    reducers: {
        setLogin: (state, action: PayloadAction<LoginResponse>) => {
            const {
                token,
                permissions = [],
                rolePermissions = {},
                roles = [],
                email,
                firstName,
                lastName,
                role,
            } = action.payload;

            const normalized = normalizeAuthRolePayload({
                role,
                roles,
                permissions,
                rolePermissions,
            });

            state.token = token || "";
            state.email = email || "";
            state.permissions = normalized.permissions;
            state.firstName = firstName || "";
            state.lastName = lastName || "";
            state.role = normalized.role;
            state.roles = normalized.roles;
            state.rolePermissions = normalized.rolePermissions;
            state.isAuthenticated = !!token;

            localStorage.setItem("token", token || "");
            localStorage.setItem("email", email || "");
            localStorage.setItem("firstName", firstName || "");
            localStorage.setItem("lastName", lastName || "");
            localStorage.setItem("role", normalized.role);
            localStorage.setItem("roles", JSON.stringify(normalized.roles));
            localStorage.setItem("permissions", JSON.stringify(normalized.permissions));
            localStorage.setItem("rolePermissions", JSON.stringify(normalized.rolePermissions));
        },
        updateUserProfile: (
            state,
            action: PayloadAction<{ firstName?: string; lastName?: string; fullName?: string }>,
        ) => {
            const { firstName, lastName, fullName } = action.payload;

            if (firstName !== undefined) {
                state.firstName = firstName;
            }
            if (lastName !== undefined) {
                state.lastName = lastName;
            }

            if (fullName !== undefined) {
                const trimmed = fullName.trim();
                const firstSpace = trimmed.indexOf(" ");
                if (firstSpace > 0) {
                    state.firstName = trimmed.substring(0, firstSpace).trim();
                    state.lastName = trimmed.substring(firstSpace + 1).trim();
                } else {
                    state.firstName = trimmed;
                    state.lastName = "";
                }
            }

            localStorage.setItem("firstName", state.firstName);
            localStorage.setItem("lastName", state.lastName);
        },
        setLogout: (state) => {
            state.token = "";
            state.email = "";
            state.firstName = "";
            state.lastName = "";
            state.role = "";
            state.roles = [];
            state.permissions = [];
            state.rolePermissions = {};
            state.isAuthenticated = false;
            clearAuthStorage();
        },
    },
});

export const { setLogin, setLogout, updateUserProfile } = authSlice.actions;
export default authSlice.reducer;
