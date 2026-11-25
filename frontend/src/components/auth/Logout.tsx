import { useRoleSwitch } from "@/contexts/RoleSwitchContext";
import type { RootState } from "@/store/store";
import { performAppLogout } from "@/utils/auth-logout";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

export const Logout = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const queryClient = useQueryClient();
    const { setViewRole } = useRoleSwitch();
    const { isAuthenticated } = useSelector((state: RootState) => state.auth);

    useEffect(() => {
        void performAppLogout({
            dispatch,
            queryClient,
            navigate,
            clearViewRole: () => setViewRole(null),
            skipApi: !isAuthenticated,
        });
    }, [dispatch, isAuthenticated, navigate, queryClient, setViewRole]);

    return null;
};
