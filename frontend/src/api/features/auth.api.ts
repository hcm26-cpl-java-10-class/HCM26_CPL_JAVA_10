import axiosInstance from "../axios";
import { getDeviceDescription } from "@/utils/device.utils";
import { normalizeAuthRolePayload } from "@/utils/rbac.utils";
import {
    type ChangePasswordRequest,
    type ForgotPasswordEmailRequest,
    type ForgotPasswordRequest,
    type LoginRequest,
    type LoginResponse,
    type RegisterRequest,
    type UserSessionDTO,
} from "../../types/features/auth";

interface BackendAuthenticationResponse {
    accessToken?: string;
    passwordChangeRequired?: boolean;
    setupToken?: string;
    email: string;
    firstName: string;
    lastName: string;
    role?: string;
    roles?: string[];
    permissions?: string[];
    rolePermissions?: Record<string, string[]>;
}

const AUTH_STORAGE_KEYS = [
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

export const mapAuthResponse = (data: BackendAuthenticationResponse): LoginResponse => {
    const normalized = normalizeAuthRolePayload({
        role: data.role,
        roles: data.roles,
        permissions: data.permissions,
        rolePermissions: data.rolePermissions,
    });

    return {
        token: data.accessToken ?? "",
        passwordChangeRequired: data.passwordChangeRequired,
        setupToken: data.setupToken,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: normalized.role,
        roles: normalized.roles,
        permissions: normalized.permissions,
        rolePermissions: normalized.rolePermissions,
    };
};

export const clearAuthStorage = () => {
    AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
};

export const authApi = {
    login: async (credentials: LoginRequest): Promise<LoginResponse> => {
        const device = credentials.device || getDeviceDescription();
        const response = await axiosInstance.post<BackendAuthenticationResponse>("/auth/login", {
            device,
            email: credentials.email,
            password: credentials.password,
            rememberMe: Boolean(credentials.isRememberedMe),
        }, {
            headers: { "X-Device-Info": device },
        });
        return mapAuthResponse(response.data);
    },

    refreshSession: async (): Promise<LoginResponse> => {
        const response = await axiosInstance.post<BackendAuthenticationResponse>("/auth/refresh", {});
        return mapAuthResponse(response.data);
    },

    logout: async () => {
        try {
            await axiosInstance.post("/auth/logout");
        } finally {
            clearAuthStorage();
        }
    },

    changePassword: async (payload: ChangePasswordRequest): Promise<void> => {
        await axiosInstance.post("/auth/change-password", payload);
    },

    listSessions: async (): Promise<UserSessionDTO[]> => {
        const response = await axiosInstance.get<UserSessionDTO[]>("/auth/sessions");
        return response.data;
    },

    revokeSession: async (sessionId: string): Promise<void> => {
        await axiosInstance.delete(`/auth/sessions/${encodeURIComponent(sessionId)}`);
    },

    revokeOtherSessions: async (): Promise<{ revokedCount: number }> => {
        const response = await axiosInstance.post<{ revokedCount: number }>("/auth/sessions/revoke-others");
        return response.data;
    },

    revokeUserSessions: async (userId: number): Promise<void> => {
        await axiosInstance.post(`/users/${userId}/revoke-sessions`);
    },

    register: async (data: RegisterRequest): Promise<void> => {
        await axiosInstance.post("/auth/register", data);
    },

    resendVerification: async (email: string): Promise<void> => {
        await axiosInstance.post("/auth/resend-verification", null, {
            params: { email },
        });
    },

    forgotPassword: async (data: ForgotPasswordEmailRequest): Promise<void> => {
        await axiosInstance.post("/auth/forgot-password", { email: data.email });
    },

    resetPassword: async (data: ForgotPasswordRequest): Promise<void> => {
        await axiosInstance.patch("/auth/reset-password", {
            token: data.token,
            newPassword: data.newPassword,
        });
    },
};
