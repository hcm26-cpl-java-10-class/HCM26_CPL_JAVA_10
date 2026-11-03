import { ArrowLeft, CalendarDays, ClipboardList, Users, Wallet, FileText } from "lucide-react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { NotIntegratedPanel } from "@/components/common/NotIntegratedPanel";
import { MainLayout } from "@/components/layout/MainLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useExternalClass } from "@/hooks/useExternalLookups";
import { classTitle } from "@/utils/class.utils";
import { ClassCalendarTab } from "./components/ClassCalendarTab";
import { ClassInfoTab } from "./components/ClassInfoTab";
import { ClassStatusBadge } from "./components/ClassStatusBadge";

const TABS = [
    { value: "info", label: "Class Info", icon: FileText },
    { value: "trainees", label: "Trainee List", icon: Users },
    { value: "calendar", label: "Calendar", icon: CalendarDays },
    { value: "budget", label: "Budget & Operation Info", icon: Wallet },
    { value: "activities", label: "Activities", icon: ClipboardList },
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
    const { classId } = useParams();
    const id = classId && /^[1-9]\d{0,14}$/.test(classId) ? classId : undefined;

    const location = useLocation();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedTab = searchParams.get("tab");
    const tab: TabValue = isTab(requestedTab) ? requestedTab : "info";

    const query = useExternalClass(id);
    const classItem = query.data;

    // The list page hands over its query string so that "Back" restores the same search / filter / page
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
                            <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-blue-800 hover:underline dark:text-blue-300">
                                <ArrowLeft className="size-4" /> Back to Class List
                            </Link>
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="break-words text-lg font-semibold">Class Details: {classTitle(classItem)}</h1>
                                <ClassStatusBadge status={classItem.status} />
                            </div>
                        </header>

                        <Tabs
                            value={tab}
                            onValueChange={(value) => setSearchParams({ tab: value }, { replace: true, state: location.state })}
                            className="gap-0"
                        >
                            <TabsList variant="line" className="h-11 w-full justify-start gap-2 overflow-x-auto rounded-none border-b px-3 sm:px-4">
                                {TABS.map(({ value, label, icon: Icon }) => (
                                    <TabsTrigger
                                        key={value}
                                        value={value}
                                        className="flex-none px-3 data-[state=active]:text-blue-800 dark:data-[state=active]:text-blue-300 after:bg-blue-800"
                                    >
                                        <Icon aria-hidden /> {label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            <div className="p-4 sm:p-5">
                                <TabsContent value="info">
                                    <ClassInfoTab classItem={classItem} />
                                </TabsContent>

                                <TabsContent value="trainees">
                                    <NotIntegratedPanel
                                        icon={Users}
                                        title="Trainee list is not integrated yet"
                                        description="The Trainee module has no screen or API for this yet and the master training system exposes no class → trainee relation, so no trainees are listed instead of showing an invented table."
                                        needs="a Trainee API that lists the trainees of a class (Trainee module owner)."
                                    />
                                </TabsContent>

                                <TabsContent value="calendar">
                                    <ClassCalendarTab classItem={classItem} />
                                </TabsContent>

                                <TabsContent value="budget">
                                    <NotIntegratedPanel
                                        icon={Wallet}
                                        title="Budget & operation info is not integrated yet"
                                        description="There is no budget or operation data source in this application, so no figures are shown."
                                        needs="a budget / operation info contract for classes (owner of that module)."
                                    />
                                </TabsContent>

                                <TabsContent value="activities">
                                    <NotIntegratedPanel
                                        icon={ClipboardList}
                                        title="Class activities are not integrated yet"
                                        description="Lessons in this application belong to Courses, not to classes, and there is no class activity API, so none are shown."
                                        needs="an Activity API linked to a class (owner of the Activity / Lesson module)."
                                    />
                                </TabsContent>
                            </div>
                        </Tabs>
                    </>
                ) : null}
            </section>
        </MainLayout>
    );
}
