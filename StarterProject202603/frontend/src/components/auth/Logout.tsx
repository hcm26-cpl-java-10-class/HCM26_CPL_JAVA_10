import { authApi } from "@/api/features/auth.api";
import { setLogout } from "@/store/slices/auth/authSlice";
import type { RootState } from "@/store/store";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

export const Logout = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { isAuthenticated } = useSelector((state: RootState) => state.auth);

    useEffect(() => {
        const performLogout = async () => {
            if (isAuthenticated) {
                await authApi.logout();
            }

            dispatch(setLogout());
            navigate("/login", { replace: true });
        };

        performLogout();
    }, [dispatch, navigate]);

    return null;
};
