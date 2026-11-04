import { useContext } from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { EmbeddedLayoutContext } from "@/components/layout/embedded-layout";
import HeaderRight from "@/components/layout/HeaderRight";
import { SidebarMenu } from "@/components/layout/Sidebar.tsx";
import DynamicBreadcrumbs from "@/components/layout/DynamicBreadcrumbs.tsx";
import { StudentNavbar } from "@/components/layout/StudentNavbar";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";
import type { ReactNode } from "react";

export function MainLayout({
    children,
    pathName,
    pathLinks,
    focusMode = false,
}: {
    children: ReactNode;
    pathName?: Record<string, string>;
    pathLinks?: Record<string, string>;
    /** Hide the navbar / breadcrumbs / sidebar (e.g. while taking an exam). */
    focusMode?: boolean;
}) {
    const { activeRole } = usePermissions();
    const embedded = useContext(EmbeddedLayoutContext);
    const isStudentView = normalizeRole(activeRole) === STUDENT_ROLE;

    if (embedded) {
        return <>{children}</>;
    }

    if (focusMode) {
        return (
            <div className="flex h-screen max-h-[calc(100vh-18px)] flex-col overflow-hidden">
                <main className="flex flex-1 min-h-0 flex-col overflow-y-auto px-6 pb-6 pt-4">
                    {children}
                </main>
            </div>
        );
    }

    if (isStudentView) {
        return (
            <div className="flex h-screen max-h-[calc(100vh-18px)] flex-col overflow-hidden">
                <StudentNavbar />

                <header className="flex h-14 shrink-0 items-center border-b px-6">
                    <DynamicBreadcrumbs pathTitles={pathName} pathLinks={pathLinks} variant="student" />
                </header>

                <main className="flex flex-1 min-h-0 flex-col overflow-y-auto px-6 pb-6 pt-4">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <SidebarProvider>
            <SidebarMenu />
            <SidebarInset className="h-screen flex flex-col overflow-hidden max-h-[calc(100vh-18px)]">
                <header className="flex h-16 shrink-0 items-center gap-2">
                    <div className="flex items-center gap-2 px-4 w-full justify-between">
                        <div className="flex items-center gap-2">
                            <DynamicBreadcrumbs pathTitles={pathName} pathLinks={pathLinks} />
                        </div>
                        <HeaderRight />
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto min-h-0 flex flex-col px-6 pb-6 pt-6">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
