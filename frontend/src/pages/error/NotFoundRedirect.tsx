import { Navigate, matchPath, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { useActiveModuleGroups } from "@/hooks/useSidebarMenus";
import { routes } from "@/router/component-registry";

/**
 * Catch-all of the router. It must not turn every problem into a 404:
 *  - not signed in                          -> /login          (401)
 *  - the menu could not be loaded           -> an error panel  (5xx / network), never "not found"
 *  - a route the app has, but this user's menu does not offer (no permission) -> /unauthorized (403)
 *  - a path the app does not have           -> /not-found-page (404)
 */
export const NotFoundRedirect = () => {
  const location = useLocation();
  const { isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );

  const { isLoading, isError, error, refetch } = useActiveModuleGroups(isAuthenticated);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <ApiErrorState error={error} resource="menu" onRetry={() => void refetch()} />
      </div>
    );
  }

  const requestedPath = `${location.pathname}${location.search}${location.hash}`;
  const isKnownRoute = routes.some(
    (route) => !route.isPublic && matchPath({ path: route.path, end: true }, location.pathname),
  );

  return (
    <Navigate
      to={isKnownRoute ? "/unauthorized" : "/not-found-page"}
      replace
      state={{ requestedPath }}
    />
  );
};
