import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import HeaderRight from "@/components/layout/HeaderRight";
import { SidebarMenu } from "@/components/layout/Sidebar.tsx";
import DynamicBreadcrumbs from "@/components/layout/DynamicBreadcrumbs.tsx";
import { StudentNavbar } from "@/components/layout/StudentNavbar";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function readSidebarOpenCookie(): boolean {
    if (typeof document === "undefined") return true;
    const match = document.cookie.match(/(?:^|;\s*)sidebar_state=(true|false)/);
    return match ? match[1] === "true" : true;
}

export function MainLayout({
                               children,
                               pathName,
                               mainClassName,
                               pathLinks,
                               contentClassName,
                               ignorePaths,
                           }: {
    children: ReactNode;
    pathName?: Record<string, string>;
    mainClassName?: string;
    contentClassName?: string;
    pathLinks?: Record<string, string>;
    /** URL segments to leave out of the breadcrumb, typically ones that have no page of their own. */
    ignorePaths?: string[];
}) {
    const { activeRole } = usePermissions();
    const isStudentView = normalizeRole(activeRole) === STUDENT_ROLE;

    if (isStudentView) {
        return (
            <div className="flex min-h-screen flex-col">
                <StudentNavbar />

                <header className="flex min-h-14 shrink-0 items-center border-b px-6 py-2">
                    <DynamicBreadcrumbs pathTitles={pathName} pathLinks={pathLinks} ignorePaths={ignorePaths} variant="student" />
                </header>

                <main className={cn("flex-1 px-6 pb-6 pt-4", mainClassName, contentClassName)}>
                    {children}
                </main>
            </div>
        );
    }

    return (
        <SidebarProvider defaultOpen={readSidebarOpenCookie()}>
            <SidebarMenu />
            <SidebarInset className="h-screen min-w-0 flex flex-col overflow-hidden max-h-[calc(100vh-18px)]">
                <header className="flex min-h-16 shrink-0 items-center gap-2 py-3">
                    <div className="flex items-center gap-2 px-4 w-full justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <SidebarTrigger aria-label="Toggle navigation sidebar" />
                            <DynamicBreadcrumbs pathTitles={pathName} pathLinks={pathLinks} ignorePaths={ignorePaths} />
                        </div>
                        <div className="shrink-0"><HeaderRight /></div>
                    </div>
                </header>

                <main className={cn("min-h-0 min-w-0 flex-1 flex flex-col overflow-x-hidden overflow-y-auto px-6 pb-6 pt-6", mainClassName, contentClassName)}>
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
