import { useSelector } from "react-redux";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./contexts/AuthContext";
import { RoleSwitchProvider } from "./contexts/RoleSwitchContext";
import { CourseProvider } from "./contexts/CourseContext";
import { usePermissions } from "./hooks/usePermissions";
import { useActiveModuleGroups } from "./hooks/useSidebarMenus";
import { NotFoundRedirect } from "./pages/error/NotFoundRedirect";
import { ROLE_HOME_PATHS, routes } from "./router/component-registry";
import type { RootState } from "./store/store";
import { getHomePathByRole } from "./utils/rbac.utils";

function AppRoutes() {
    const { isAuthenticated, permissions } = useSelector((state: RootState) => state.auth);
    const { activeRole, effectivePermissions } = usePermissions();
    const { data: moduleGroups = [] } = useActiveModuleGroups(isAuthenticated);

    const homePath = isAuthenticated ? getHomePathByRole(activeRole, effectivePermissions ?? permissions) : "/login";

    // Create component lookup map from module-driven routes
    const explicitOverrides: Record<string, any> = {
        "/courses": routes.find((r) => r.path === "/courses")?.component,
        "/enrollments": routes.find((r) => r.path === "/enrollments")?.component,
        "/course-enrollments": routes.find((r) => r.path === "/course-enrollments")?.component,
        "/my-learning": routes.find((r) => r.path === "/my-learning")?.component,
        "/fams/my-learning": routes.find((r) => r.path === "/fams/my-learning")?.component,
        "/learning": routes.find((r) => r.path === "/learning")?.component,
        "/profile": routes.find((r) => r.path === "/profile")?.component,
        "/fams/profile": routes.find((r) => r.path === "/fams/profile")?.component,
        "/fams/ho-so-ca-nhan-oi-mat-khau": routes.find((r) => r.path === "/fams/ho-so-ca-nhan-oi-mat-khau")?.component,
        "/fams/ho-so-ca-nhan-doi-mat-khau": routes.find((r) => r.path === "/fams/ho-so-ca-nhan-doi-mat-khau")?.component,
    };

    const componentRegistry = {
        ...Object.fromEntries(
            routes.filter((r) => r.isModuleDriven).map((r) => [r.path, r.component]),
        ),
        ...explicitOverrides,
    };

    const staticRoutes = routes.filter((r) => !r.isModuleDriven);
    const staticRoutePaths = new Set(staticRoutes.map((r) => r.path));

    return (
        <Routes>
            <Route path="/" element={<Navigate to={homePath} replace />} />

            {/* Dynamic routes from backend Module table */}
            {moduleGroups.flatMap((group) =>
                group.modules.map((m) => {
                    // Frontend-controlled routes already include their permission checks.
                    if (!m.url || staticRoutePaths.has(m.url)) return null;
                    if ((ROLE_HOME_PATHS as readonly string[]).includes(m.url)) {
                        return null;
                    }
                    const Component = componentRegistry[m.url];

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
                    <CourseProvider>
                        <AppRoutes />
                    </CourseProvider>
                </RoleSwitchProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
