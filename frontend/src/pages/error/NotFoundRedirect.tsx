import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { Loader2 } from "lucide-react";
import type { RootState } from "@/store/store";
import { useActiveModuleGroups } from "@/hooks/useSidebarMenus";

export const NotFoundRedirect = () => {
  const location = useLocation();
  const { isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );

  const { isLoading } = useActiveModuleGroups(isAuthenticated);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          <span>Loading...</span>
        </div>
      </div>
    );
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
