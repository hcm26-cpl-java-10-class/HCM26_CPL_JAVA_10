import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import HeaderRight from "@/components/layout/HeaderRight";
import {SidebarMenu} from "@/components/layout/Sidebar.tsx";
import DynamicBreadcrumbs from "@/components/layout/DynamicBreadcrumbs.tsx";
import { StudentNavbar } from "@/components/layout/StudentNavbar";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";

export function MainLayout({
                               children,
                               pathName,
                           }: {
    children: React.ReactNode;
    pathName?: Record<string, string>;
}) {
    const { activeRole } = usePermissions();
    const isStudentView = normalizeRole(activeRole) === STUDENT_ROLE;

    if (isStudentView) {
        return (
            <div className="flex h-screen max-h-[calc(100vh-18px)] flex-col overflow-hidden">
                <StudentNavbar />

                <header className="flex min-h-14 shrink-0 items-center border-b px-6 py-2">
                    <DynamicBreadcrumbs pathTitles={pathName} variant="student" />
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
            <SidebarInset  className="h-screen flex flex-col overflow-hidden max-h-[calc(100vh-18px)]">
                <header className="flex min-h-16 shrink-0 items-center gap-2 py-3">
                    <div className="flex items-center gap-2 px-4 w-full justify-between">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <SidebarTrigger aria-label="Toggle navigation sidebar" />
                            <DynamicBreadcrumbs pathTitles={pathName} />
                        </div>
                        <div className="shrink-0"><HeaderRight /></div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto min-h-0 flex flex-col px-6 pb-6 pt-6">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
