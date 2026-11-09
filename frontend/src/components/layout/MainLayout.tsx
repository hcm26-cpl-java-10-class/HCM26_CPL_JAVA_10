import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import HeaderRight from "@/components/layout/HeaderRight";
import { SidebarMenu } from "@/components/layout/Sidebar.tsx";
import DynamicBreadcrumbs from "@/components/layout/DynamicBreadcrumbs.tsx";
import { StudentNavbar } from "@/components/layout/StudentNavbar";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";
import { useContext, type ReactNode } from "react";
import { EmbeddedLayoutContext } from "@/components/layout/embedded-layout";

export function MainLayout({
    children,
    pathName,
    plainBreadcrumb = false,
    headerContent,
}: {
    children: React.ReactNode;
    pathName?: Record<string, string>;
    plainBreadcrumb?: boolean;
    headerContent?: React.ReactNode;
}) {
    const isEmbedded = useContext(EmbeddedLayoutContext);
    if (isEmbedded) {
        return <>{children}</>;
    }

    const { activeRole } = usePermissions();
    const isStudentView = normalizeRole(activeRole) === STUDENT_ROLE;

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
            <div className="flex min-h-screen flex-col">
                <StudentNavbar />

                <header className="flex min-h-14 shrink-0 items-center border-b px-6 py-2">
                    <DynamicBreadcrumbs pathTitles={pathName} pathLinks={pathLinks} variant="student" />
                </header>

                <main className="flex-1 px-6 pb-6 pt-4">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <SidebarProvider>
            <SidebarMenu />
            <SidebarInset className="h-screen min-w-0 flex flex-col overflow-hidden max-h-[calc(100vh-18px)]">
                <header className={`flex shrink-0 items-center gap-2 ${dense ? "min-h-11 py-0.5" : "min-h-16 py-3"}`}>
                    <div className="flex items-center gap-2 px-4 w-full justify-between">
                        {headerContent ?? (
                            <>
                                <div className="flex items-center gap-2">
                                    <DynamicBreadcrumbs pathTitles={pathName} plain={plainBreadcrumb} />
                                </div>
                                <HeaderRight />
                            </>
                        )}
                    </div>
                </header>

                <main className={`min-h-0 min-w-0 flex-1 flex flex-col overflow-x-hidden overflow-y-auto ${dense ? "px-4 pb-3 pt-1" : "px-6 pb-6 pt-6"}`}>
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
