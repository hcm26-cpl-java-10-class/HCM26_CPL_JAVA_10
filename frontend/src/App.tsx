import { useSelector } from "react-redux";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { RoleSwitchProvider } from "./contexts/RoleSwitchContext";
import { usePermissions } from "./hooks/usePermissions";
import { useActiveModuleGroups } from "./hooks/useSidebarMenus";
import { NotFoundRedirect } from "./pages/error/NotFoundRedirect";
import { routes } from "./router/component-registry";
import type { RootState } from "./store/store";
import { getHomePathByRole } from "./utils/rbac.utils";

function AppRoutes() {
    const { isAuthenticated } = useSelector((state: RootState) => state.auth);
    const { activeRole } = usePermissions();
    const { data: moduleGroups = [] } = useActiveModuleGroups(isAuthenticated);

    const homePath = isAuthenticated ? getHomePathByRole(activeRole) : "/login";

    // Create component lookup map from registered routes
    const componentRegistry = Object.fromEntries(
        routes.map((r) => [r.path, r.component]),
    );

    // Get non-module routes (frontend-controlled)
    const staticRoutes = routes.filter((r) => !r.isModuleDriven);

    return (
        <Routes>
            {/* Root redirect */}
            <Route path="/" element={<Navigate to={homePath} replace />} />

            {/* Dynamic routes from backend Module table */}
            {moduleGroups.flatMap((group) =>
                group.modules.map((m) => {
                    if (!m.url) return null;
                    const Component = componentRegistry[m.url];

                    if (!Component) {
                        return <Route key={`missing-${m.id ?? m.url}`} path={m.url} element={<Navigate to="/not-found-page" replace />} />;
                    }

                    return (
                        <Route
                            key={m.id}
                            path={m.url}
                            element={
                                <ProtectedRoute requiredPermission={m.requiredPermission}>
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
