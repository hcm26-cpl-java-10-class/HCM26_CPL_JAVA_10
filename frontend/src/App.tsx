import { useSelector } from "react-redux";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { RoleSwitchProvider } from "./contexts/RoleSwitchContext";
import { usePermissions } from "./hooks/usePermissions";
import { useActiveModuleGroups } from "./hooks/useSidebarMenus";
import { NotFoundRedirect } from "./pages/error/NotFoundRedirect";
import { routes, type RouteConfig } from "./router/component-registry";
import type { RootState } from "./store/store";
import { getHomePathByRole } from "./utils/rbac.utils";

function AppRoutes() {
    const { isAuthenticated } = useSelector((state: RootState) => state.auth);
    const { activeRole } = usePermissions();
    const { data: moduleGroups = [] } = useActiveModuleGroups(isAuthenticated);

    const homePath = isAuthenticated ? getHomePathByRole(activeRole) : "/login";

    // Lookup map from ALL known routes
    const componentLookup = new Map<string, RouteConfig>();
    for (const r of routes) {
        componentLookup.set(r.path, r);
    }

    const dynamicPaths = new Set<string>();

    return (
        <Routes>
            {/* Root redirect */}
            <Route path="/" element={<Navigate to={homePath} replace />} />

            {/* Dynamic routes from backend Module table */}
            {moduleGroups.flatMap((group) =>
                group.modules.map((m) => {
                    if (!m.url) return null;
                    const routeConfig = componentLookup.get(m.url);

                    if (!routeConfig) {
                        return null;
                    }

                    dynamicPaths.add(m.url);
                    const Component = routeConfig.component;
                    const requiredPermission = m.requiredPermission || routeConfig.requiredPermission;

                    return (
                        <Route
                            key={`mod-${m.id ?? m.url}`}
                            path={m.url}
                            element={
                                <ProtectedRoute requiredPermission={requiredPermission}>
                                    <Component />
                                </ProtectedRoute>
                            }
                        />
                    );
                }),
            )}

            {/* Static routes for public pages and any route not provided by backend Module table */}
            {routes
                .filter((route) => !dynamicPaths.has(route.path))
                .map((route, index) => {
                    const Component = route.component;

                    if (route.isPublic) {
                        return <Route key={`pub-${route.path}-${index}`} path={route.path} element={<Component />} />;
                    }

                    return (
                        <Route
                            key={`stat-${route.path}-${index}`}
                            path={route.path}
                            element={
                                <ProtectedRoute requiredPermission={route.requiredPermission}>
                                    <Component />
                                </ProtectedRoute>
                            }
                        />
                    );
                })}

            {/* Catch all */}
            <Route path="*" element={<NotFoundRedirect />} />
        </Routes>
    );
}

function App() {
    return (
        <BrowserRouter>
            <Toaster
                duration={1500}
                position="top-right"
                richColors
                toastOptions={{
                    className: "p-4",
                }}
            />
            <AuthProvider>
                <RoleSwitchProvider>
                    <AppRoutes />
                </RoleSwitchProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
