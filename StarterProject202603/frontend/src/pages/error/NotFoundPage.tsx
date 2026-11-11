import type { RootState } from "@/store/store";
import { usePermissions } from "@/hooks/usePermissions";
import { getHomePathByRole } from "@/utils/rbac.utils";
import { useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";

interface NotFoundPageProps {
    isAuthenticated?: boolean;
}

export default function NotFoundPage({ isAuthenticated }: NotFoundPageProps) {
    const navigate = useNavigate();
    const { isAuthenticated: authState, role } = useSelector((state: RootState) => state.auth);
    const { activeRole } = usePermissions();
    const resolvedAuth = isAuthenticated ?? authState;
    const homePath = getHomePathByRole(activeRole ?? role);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
            <h1 className="text-7xl font-bold text-primary">404</h1>

            <p className="mt-4 text-xl font-semibold">Page Not Found</p>

            <p className="mt-2 max-w-md text-muted-foreground">
                Sorry, the page you are looking for does not exist or has been moved.
                Please check the URL or return to the dashboard.
            </p>

            <div className="mt-6 flex gap-3">
                {resolvedAuth ? (
                    <Link
                        to={homePath}
                        className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                    >
                        Go to Home
                    </Link>
                ) : (
                    <Link
                        to="/login"
                        className="rounded-md border px-5 py-2 text-sm font-medium hover:bg-muted"
                    >
                        Back to Login
                    </Link>
                )}

                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="rounded-md border px-5 py-2 text-sm font-medium hover:bg-muted"
                >
                    Go Back
                </button>
            </div>
        </div>
    );
}
