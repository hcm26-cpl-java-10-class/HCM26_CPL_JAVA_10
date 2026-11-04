import { useEffect, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import { jwtDecode } from "jwt-decode";
import { setLogin } from "@/store/slices/auth/authSlice";
import type { LoginResponse } from "@/types";
import { availableAccountViews, getHomePathByRole, normalizeAuthRolePayload } from "@/utils/rbac.utils";

export const OAuth2RedirectHandler = () => {
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    // React StrictMode runs effects twice while developing. The first run navigates away and clears the
    // "#token=..." part of the address, so the second run used to find no token and sent the user back
    // to the login page with "did not return an access token". Handle the redirect only once.
    const handled = useRef(false);

    useEffect(() => {
        if (handled.current) {
            return;
        }
        handled.current = true;

        const error = searchParams.get("error");
        // The backend puts the token in the URL fragment (#token=...) so it never reaches a server log.
        // The query string is still read for older links. The fragment comes from the router location,
        // which does not change under our feet while we navigate.
        const token =
            new URLSearchParams(location.hash.replace(/^#/, "")).get("token") ??
            searchParams.get("token");

        if (error) {
            // Keep the reason (not registered, locked, ...) so the login page can explain it.
            navigate(`/login?error=${encodeURIComponent(error)}`, { replace: true });
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
            navigate(getHomePathByRole(availableAccountViews(userData.permissions ?? [])[0], userData.permissions), { replace: true });
        } catch {
            navigate("/login?error=google_token_invalid", { replace: true });
        }
    }, [searchParams, location.hash, dispatch, navigate]);

    return (
        <div className="flex h-screen items-center justify-center">
            <p>Processing...</p>
        </div>
    );
};
