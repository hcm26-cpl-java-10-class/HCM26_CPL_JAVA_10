import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import HeaderRight from "@/components/layout/HeaderRight";
import { SidebarMenu } from "@/components/layout/Sidebar.tsx";
import DynamicBreadcrumbs from "@/components/layout/DynamicBreadcrumbs.tsx";
import { StudentNavbar } from "@/components/layout/StudentNavbar";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";

export function MainLayout({
    children,
    pathName,
    plainBreadcrumb = false,
}: {
    children: React.ReactNode;
    pathName?: Record<string, string>;
    plainBreadcrumb?: boolean;
}) {
    const { activeRole } = usePermissions();
    const isStudentView = normalizeRole(activeRole) === STUDENT_ROLE;

    if (isStudentView) {
        return (
            <div className="flex h-screen max-h-[calc(100vh-18px)] flex-col overflow-hidden">
                <StudentNavbar />

                <header className="flex h-14 shrink-0 items-center border-b px-6">
                    <DynamicBreadcrumbs pathTitles={pathName} variant="student" />
                </header>

                <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-6 pb-6 pt-4">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <SidebarProvider>
            <SidebarMenu />
            <SidebarInset className="h-screen min-w-0 flex flex-col overflow-hidden max-h-[calc(100vh-18px)]">
                <header className="flex h-16 shrink-0 items-center gap-2">
                    <div className="flex items-center gap-2 px-4 w-full justify-between">
                        <div className="flex items-center gap-2">
                            <DynamicBreadcrumbs pathTitles={pathName} plain={plainBreadcrumb} />
                        </div>
                        <HeaderRight />
                    </div>
                </header>

                <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto flex flex-col px-6 pb-6 pt-6">
                    {children}
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}
