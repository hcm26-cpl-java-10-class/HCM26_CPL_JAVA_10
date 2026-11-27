import type { AuthState, LoginResponse } from "@/types/features/auth";
import { normalizeAuthRolePayload } from "@/utils/rbac.utils";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

const LEGACY_AUTH_STORAGE_KEYS = [
    "token",
    "email",
    "firstName",
    "lastName",
    "role",
    "roles",
    "permissions",
    "rolePermissions",
    "viewRole",
];
const clearRecommendationChats = () => {
    try { Object.keys(sessionStorage).filter(key => key.startsWith("course_recommendation_chat:")).forEach(key => sessionStorage.removeItem(key)); } catch { /* Storage may be disabled. */ }
};

LEGACY_AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
sessionStorage.removeItem("fams.auth.tab");

const emptyAuthState: AuthState = {
    token: "",
    email: "",
    firstName: "",
    lastName: "",
    role: "",
    roles: [],
    permissions: [],
    rolePermissions: {},
    isAuthenticated: false,
    isAuthInitialized: false,
};

const authSlice = createSlice({
    name: "auth",
    initialState: emptyAuthState,
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

            if (state.email !== email) clearRecommendationChats();
            state.token = token || "";
            state.email = email || "";
            state.permissions = normalized.permissions;
            state.firstName = firstName || "";
            state.lastName = lastName || "";
            state.role = normalized.role;
            state.roles = normalized.roles;
            state.rolePermissions = normalized.rolePermissions;
            state.isAuthenticated = !!token;
            state.isAuthInitialized = true;
        },
        setAuthInitialized: (state) => {
            state.isAuthInitialized = true;
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
            state.isAuthInitialized = true;
            clearRecommendationChats();
            sessionStorage.removeItem("fams.auth.tab");
            LEGACY_AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
        },
        updateUserProfile: (
            state,
            action: PayloadAction<{ firstName?: string; lastName?: string; fullName?: string }>,
        ) => {
            if (action.payload.firstName !== undefined) state.firstName = action.payload.firstName;
            if (action.payload.lastName !== undefined) state.lastName = action.payload.lastName;
        },
    },
});

export const { setLogin, setLogout, setAuthInitialized, updateUserProfile } = authSlice.actions;
export default authSlice.reducer;
