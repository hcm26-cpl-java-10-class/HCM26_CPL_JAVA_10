import { useSelector } from "react-redux";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { RoleSwitchProvider } from "./contexts/RoleSwitchContext";
import { usePermissions } from "./hooks/usePermissions";
import { useActiveModuleGroups } from "./hooks/useSidebarMenus";
import { NotFoundRedirect } from "./pages/error/NotFoundRedirect";
import { ROLE_HOME_PATHS, routes } from "./router/component-registry";
import type { RootState } from "./store/store";
import { getHomePathByRole } from "./utils/rbac.utils";
import { resolveMenuPermission } from "./router/menu-permission.utils";

function AppRoutes() {
    const { isAuthenticated } = useSelector((state: RootState) => state.auth);
    const { activeRole, effectivePermissions } = usePermissions();
    const { data: moduleGroups = [] } = useActiveModuleGroups(isAuthenticated);

    const homePath = isAuthenticated ? getHomePathByRole(activeRole, effectivePermissions) : "/login";

    // Backend menus may point to either explicit or generated routes. Prefer explicit implementations.
    const componentRegistry = Object.fromEntries(
        [...routes.filter(r => r.isModuleDriven), ...routes.filter(r => !r.isModuleDriven)]
            .map(r => [r.path, r]),
    );

    // Get non-module routes (frontend-controlled)
    const menuPaths = new Set(moduleGroups.flatMap(group => group.modules.map(module => module.url)));
    const staticRoutes = routes.filter((r) => !r.isModuleDriven && !menuPaths.has(r.path));

    return (
        <Routes>
            <Route path="/" element={<Navigate to={homePath} replace />} />

            {/* Dynamic routes from backend Module table */}
            {moduleGroups.flatMap((group) =>
                group.modules.map((m) => {
                    if (!m.url) return null;
                    const registered = componentRegistry[m.url];
                    const Component = registered?.component;

                    if (!Component) {
                        // Frontend-controlled pages can still be exposed in the sidebar.
                        // Their static route below is responsible for rendering them.
                        return null;
                    }

                    return (
                        <Route
                            key={m.id}
                            path={m.url}
                            element={
                                <ProtectedRoute requiredPermission={resolveMenuPermission(m.url, m.requiredPermission)}
                                    requiredPermissions={registered.requiredPermission ? [registered.requiredPermission] : undefined} requireAll>
                                    <Component />
                                </ProtectedRoute>
                            }
                        />
                    );
                }),
            )}

            {/* Static routes from componentRegistry */}
            {staticRoutes.map((route, index) => {
                const Component = route.component;

                if (route.isPublic) {
                    return <Route key={index} path={route.path} element={<Component />} />;
                }

                return (
                    <Route
                        key={index}
                        path={route.path}
                        element={
                            <ProtectedRoute
                                requiredPermission={route.requiredPermission}
                                requiredPermissions={route.requiredPermissions}
                            >
                                <Component />
                            </ProtectedRoute>
                        }
                    />
                );
            })}

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
