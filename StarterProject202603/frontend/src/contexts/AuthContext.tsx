/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, type ReactNode } from "react";
import { useSelector, useDispatch } from "react-redux";
import { type RootState } from "../store/store";
import { setLogin, setLogout } from "../store/slices/auth/authSlice";
import { type AuthContextType, type LoginRequest, type LoginResponse } from "../types/features/auth";
import { authApi } from "../api/features/auth.api";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const dispatch = useDispatch();

    const { token, email, firstName, lastName, role, roles, permissions, rolePermissions, isAuthenticated } = useSelector(
        (state: RootState) => state.auth,
    );

    const user = isAuthenticated
        ? ({ email, firstName, lastName, role, roles, permissions, rolePermissions, token } as LoginResponse)
        : null;

    const login = async (credentials: LoginRequest): Promise<LoginResponse> => {
        const response = await authApi.login(credentials);
        dispatch(setLogin(response));
        return response;
    };

    const logout = () => {
        dispatch(setLogout());
    };

    const hasPermission = (p: string) => permissions.includes(p);
    const hasAnyPermission = (pms: string[]) => pms.some((p) => permissions.includes(p));
    const hasAllPermissions = (pms: string[]) => pms.every((p) => permissions.includes(p));
    const setGoogleUser = (userData: LoginResponse) => dispatch(setLogin(userData));

    const value: AuthContextType = {
        user,
        login,
        logout,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        isAuthenticated,
        setGoogleUser,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
