import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { useActiveModuleGroups } from "@/hooks/useSidebarMenus";

export const NotFoundRedirect = () => {
  const location = useLocation();
  const { isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );

  const { isLoading } = useActiveModuleGroups(isAuthenticated);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const requestedPath = `${location.pathname}${location.search}${location.hash}`;

  return (
    <Navigate
      to="/not-found-page"
      replace
      state={{ requestedPath }}
    />
  );
};
