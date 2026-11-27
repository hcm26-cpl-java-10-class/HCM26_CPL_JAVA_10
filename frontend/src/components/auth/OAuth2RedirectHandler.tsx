import { authApi } from "@/api/features/auth.api";
import { useRoleSwitch } from "@/contexts/RoleSwitchContext";
import { setLogin } from "@/store/slices/auth/authSlice";
import type { LoginResponse } from "@/types";
import { getHomePathByRole, normalizeAuthRolePayload, resolveEffectivePermissions } from "@/utils/rbac.utils";
import { jwtDecode } from "jwt-decode";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";

export const OAuth2RedirectHandler = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { setViewRole } = useRoleSwitch();

    useEffect(() => {
        let cancelled = false;
        const error = searchParams.get("error");
        const legacyToken = searchParams.get("token");

        if (error) {
            navigate("/login?error=google_auth_failed", { replace: true });
            return;
        }

        const completeSignIn = (userData: LoginResponse) => {
            if (cancelled) return;
            setViewRole(null);
            dispatch(setLogin(userData));
            navigate(
                getHomePathByRole(
                    userData.role,
                    resolveEffectivePermissions(userData.role, userData.rolePermissions, userData.permissions),
                ),
                { replace: true },
            );
        };

        if (legacyToken) {
            try {
                const decoded = jwtDecode<Record<string, unknown>>(legacyToken);
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

                completeSignIn({
                    token: legacyToken,
                    email: typeof decoded.email === "string" ? decoded.email : "",
                    firstName: typeof decoded.firstName === "string" ? decoded.firstName : "",
                    lastName: typeof decoded.lastName === "string" ? decoded.lastName : "",
                    role: normalized.role,
                    roles: normalized.roles,
                    permissions: normalized.permissions,
                    rolePermissions: normalized.rolePermissions,
                });
            } catch {
                navigate("/login?error=google_token_invalid", { replace: true });
            }
            return;
        }

        authApi
            .refreshSession()
            .then(completeSignIn)
            .catch(() => {
                if (!cancelled) {
                    navigate("/login?error=google_auth_failed", { replace: true });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [searchParams, dispatch, navigate, setViewRole]);

    return (
        <div className="flex h-screen items-center justify-center">
            <p>Processing...</p>
        </div>
    );
};
