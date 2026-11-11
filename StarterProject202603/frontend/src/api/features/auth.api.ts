import axiosInstance from "../axios";
import { normalizeAuthRolePayload } from "@/utils/rbac.utils";
import {
    type ForgotPasswordEmailRequest,
    type ForgotPasswordRequest,
    type LoginRequest,
    type LoginResponse,
    type RegisterRequest,
} from "../../types/features/auth";

interface BackendAuthenticationResponse {
    accessToken: string;
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
];

const mapAuthResponse = (data: BackendAuthenticationResponse): LoginResponse => {
    const normalized = normalizeAuthRolePayload({
        role: data.role,
        roles: data.roles,
        permissions: data.permissions,
        rolePermissions: data.rolePermissions,
    });

    return {
        token: data.accessToken,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: normalized.role,
        roles: normalized.roles,
        permissions: normalized.permissions,
        rolePermissions: normalized.rolePermissions,
    };
};

const clearAuthStorage = () => {
    AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
};

export const authApi = {
    login: async (credentials: LoginRequest): Promise<LoginResponse> => {
        const response = await axiosInstance.post<BackendAuthenticationResponse>("/auth/login", {
            email: credentials.email,
            password: credentials.password,
        });
        return mapAuthResponse(response.data);
    },

    logout: async () => {
        try {
            await axiosInstance.post("/auth/logout");
        } finally {
            clearAuthStorage();
        }
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
