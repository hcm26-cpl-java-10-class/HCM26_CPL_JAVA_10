import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { jwtDecode } from "jwt-decode";
import { setLogin } from "@/store/slices/auth/authSlice";
import type { LoginResponse } from "@/types";
import { getHomePathByRole, normalizeAuthRolePayload } from "@/utils/rbac.utils";

export const OAuth2RedirectHandler = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    useEffect(() => {
        const error = searchParams.get("error");
        const token = searchParams.get("token");

        if (error) {
            navigate("/login?error=google_auth_failed", { replace: true });
            return;
        }

        if (!token) {
            navigate("/login?error=google_token_missing", { replace: true });
            return;
        }

        try {
            const decoded = jwtDecode<Record<string, unknown>>(token);
            const normalized = normalizeAuthRolePayload({
                role: typeof decoded.role === "string" ? decoded.role : "",
                roles: Array.isArray(decoded.roles)
                    ? decoded.roles.filter((item): item is string => typeof item === "string")
                    : [],
                permissions: Array.isArray(decoded.permissions)
                    ? decoded.permissions.filter((item): item is string => typeof item === "string")
                    : [],
                rolePermissions:
                    decoded.rolePermissions && typeof decoded.rolePermissions === "object"
                        ? (decoded.rolePermissions as Record<string, string[]>)
                        : {},
            });

            const userData: LoginResponse = {
                token,
                email: typeof decoded.email === "string" ? decoded.email : "",
                firstName: typeof decoded.firstName === "string" ? decoded.firstName : "",
                lastName: typeof decoded.lastName === "string" ? decoded.lastName : "",
                role: normalized.role,
                roles: normalized.roles,
                permissions: normalized.permissions,
                rolePermissions: normalized.rolePermissions,
            };

            dispatch(setLogin(userData));
            navigate(getHomePathByRole(userData.role), { replace: true });
        } catch {
            navigate("/login?error=google_token_invalid", { replace: true });
        }
    }, [searchParams, dispatch, navigate]);

    return (
        <div className="flex h-screen items-center justify-center">
            <p>Processing...</p>
        </div>
    );
};
