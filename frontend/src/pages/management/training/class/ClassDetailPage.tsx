import { useState } from "react";
import {
    ArrowLeft,
    CalendarDays,
    ClipboardList,
    FileText,
    Users,
    Wallet,
} from "lucide-react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { MainLayout } from "@/components/layout/MainLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useExternalClass } from "@/hooks/useExternalLookups";
import { classTitle } from "@/utils/class.utils";
import { ClassBudgetTab } from "./components/ClassBudgetTab";
import { ClassCalendarTab } from "./components/ClassCalendarTab";
import { ClassInfoTab } from "./components/ClassInfoTab";
import { ClassSessionsTab } from "./components/ClassSessionsTab";
import { ClassStatusBadge } from "./components/ClassStatusBadge";
import { ClassTraineeTab } from "./components/ClassTraineeTab";

const TABS = [
    { value: "info", label: "Class Info", icon: FileText },
    { value: "trainees", label: "Trainee List", icon: Users },
    { value: "sessions", label: "Sessions", icon: CalendarDays },
    { value: "calendar", label: "Calendar", icon: ClipboardList },
    { value: "budget", label: "Budget & Operation", icon: Wallet },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const isTab = (value: string | null): value is TabValue => TABS.some((tab) => tab.value === value);

const CLASS_LIST_PATH = "/classes";

function DetailsSkeleton() {
    return (
        <div role="status" aria-busy="true" aria-label="Loading class" className="space-y-5 p-5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-7 w-80" />
            <Skeleton className="h-9 w-full max-w-2xl" />
            <div className="grid gap-4 pt-2 md:grid-cols-3">
                {Array.from({ length: 9 }, (_, index) => (
                    <Skeleton key={index} className="h-6 w-full" />
                ))}
            </div>
        </div>
    );
}

export default function ClassDetailPage() {
    const [calendarDirty, setCalendarDirty] = useState(false);
    const { classId } = useParams();
    const id = classId && /^[1-9]\d{0,14}$/.test(classId) ? classId : undefined;

    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = searchParams.get("tab");
    const tab: TabValue = isTab(requestedTab) ? requestedTab : "info";

    const query = useExternalClass(id);
    const classItem = query.data;

    const listSearch = (location.state as { listSearch?: string } | null)?.listSearch;
    const backTo = listSearch ? `${CLASS_LIST_PATH}?${listSearch}` : CLASS_LIST_PATH;

    return (
        <MainLayout pathName={{ classes: "Class List", ...(id && classItem ? { [id]: classTitle(classItem) } : {}) }}>
            <section className="w-full min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
                {!id ? (
                    <ApiErrorState
                        error={undefined}
                        kind="notFound"
                        resource="class"
                        backTo={{ to: CLASS_LIST_PATH, label: "Back to Class List" }}
                    />
                ) : query.isPending ? (
                    <DetailsSkeleton />
                ) : query.isError ? (
                    <ApiErrorState
                        error={query.error}
                        resource="class"
                        onRetry={() => void query.refetch()}
                        backTo={{ to: CLASS_LIST_PATH, label: "Back to Class List" }}
                    />
                ) : classItem ? (
                    <>
                        <header className="space-y-2 border-b p-4 sm:p-5">
                            <Link
                                to={backTo}
                                className="inline-flex items-center gap-1 text-sm text-blue-800 hover:underline dark:text-blue-300"
                            >
                                <ArrowLeft className="size-4" /> Back to Class List
                            </Link>
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="break-words text-lg font-semibold">
                                    Class Details: {classTitle(classItem)}
                                </h1>
                                <ClassStatusBadge status={classItem.status} />
                            </div>
                        </header>

                        <Tabs
                            value={tab}
                            activationMode="manual"
                            onValueChange={(value) => {
                                if (value !== tab && calendarDirty && !window.confirm("You have unsaved calendar changes. Leave and discard them?")) return;
                                setSearchParams({ tab: value }, { replace: true, state: location.state });
                            }}
                            className="gap-0"
                        >
                            <TabsList
                                variant="line"
                                className="group-data-[orientation=horizontal]/tabs:h-14 w-full justify-start gap-2 overflow-x-auto overflow-y-hidden rounded-none border-b px-3 sm:gap-3 sm:px-4"
                            >
                                {TABS.map(({ value, label, icon: Icon }) => (
                                    <TabsTrigger
                                        key={value}
                                        value={value}
                                        className="flex-none gap-2 px-3 text-sm font-semibold sm:px-4 sm:text-base data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-300 after:bottom-0 after:bg-blue-800"
                                    >
                                        <Icon aria-hidden className="size-4 sm:size-5" /> {label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            <div className="p-4 sm:p-5">
                                <TabsContent value="info">
                                    <ClassInfoTab classItem={classItem} />
                                </TabsContent>

                                <TabsContent value="trainees">
                                    <ClassTraineeTab classItem={classItem} />
                                </TabsContent>

                                <TabsContent value="sessions">
                                    <ClassSessionsTab classItem={classItem} />
                                </TabsContent>

                                <TabsContent value="calendar">
                                    <ClassCalendarTab key={classItem.id} classItem={classItem} onDirtyChange={setCalendarDirty} />
                                </TabsContent>

                                <TabsContent value="budget">
                                    <ClassBudgetTab classItem={classItem} />
                                </TabsContent>
                            </div>
                        </Tabs>
                    </>
                ) : null}
            </section>
        </MainLayout>
    );
}
