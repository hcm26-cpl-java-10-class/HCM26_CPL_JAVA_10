import axios from "axios";
import { store } from "@/store/store";
import { setLogin, setLogout } from "@/store/slices/auth/authSlice";
import { normalizeAuthRolePayload } from "@/utils/rbac.utils";

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

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080/api";

const mapAuthResponse = (data: BackendAuthenticationResponse) => {
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

const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        "Content-Type": "application/json",
    },
    withCredentials: true,
});

axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        const requestUrl = config.url ?? "";
        const isAuthRequest = requestUrl.startsWith("/auth/") || requestUrl.includes("/auth/");

        if (token && !isAuthRequest) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    },
);

axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalReq = error.config;
        const requestUrl = originalReq?.url ?? "";

        if (!originalReq) {
            return Promise.reject(error);
        }

        if (
            error?.response?.status === 401 &&
            !originalReq._retry &&
            !requestUrl.includes("/auth/login") &&
            !requestUrl.includes("/auth/logout") &&
            !requestUrl.includes("/auth/refresh")
        ) {
            originalReq._retry = true;
            try {
                const res = await axios.post<BackendAuthenticationResponse>(
                    `${API_BASE_URL}/auth/refresh`,
                    {},
                    { withCredentials: true },
                );
                const authData = mapAuthResponse(res.data);

                store.dispatch(setLogin(authData));
                originalReq.headers = {
                    ...originalReq.headers,
                    Authorization: `Bearer ${authData.token}`,
                };

                return axiosInstance(originalReq);
            } catch (err) {
                store.dispatch(setLogout());
                window.location.href = "/login";
                return Promise.reject(err);
            }
        }

        return Promise.reject(error);
    },
);

export default axiosInstance;
