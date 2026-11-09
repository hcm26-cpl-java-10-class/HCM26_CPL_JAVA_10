import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { jwtDecode } from "jwt-decode";
import { setLogin } from "@/store/slices/auth/authSlice";
import type { LoginResponse } from "@/types";
import { availableAccountViews, getHomePathByRole, normalizeAuthRolePayload, resolveEffectivePermissions } from "@/utils/rbac.utils";
import { useRoleSwitch } from "@/contexts/RoleSwitchContext";

export const OAuth2RedirectHandler = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { setViewRole } = useRoleSwitch();

    useEffect(() => {
        const error = searchParams.get("error");
        let token = searchParams.get("token");
        if (!token && window.location.hash.includes("token=")) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            token = hashParams.get("token");
        }

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

            setViewRole(null);
            dispatch(setLogin(userData));
            const homeRole = availableAccountViews(userData.permissions ?? [])[0] ?? userData.role;
            const effectivePerms = resolveEffectivePermissions(homeRole, userData.rolePermissions, userData.permissions);
            navigate(getHomePathByRole(homeRole, effectivePerms), { replace: true });
        } catch {
            navigate("/login?error=google_token_invalid", { replace: true });
        }
    }, [searchParams, dispatch, navigate, setViewRole]);

    return (
        <div className="flex h-screen items-center justify-center">
            <p>Processing...</p>
        </div>
    );
};
