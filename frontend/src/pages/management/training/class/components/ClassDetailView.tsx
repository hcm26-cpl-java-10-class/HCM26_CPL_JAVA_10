import { ArrowLeft, HelpCircle } from "lucide-react";
import { type MouseEvent, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClasses } from "@/hooks/useClasses";
import { cn } from "@/lib/utils";
import { classTitle, getClassStatusMeta } from "@/utils/class.utils";
import { ClassActivitiesTab } from "./ClassActivitiesTab";
import { ClassBudgetTab } from "./ClassBudgetTab";
import { ClassCalendarTab } from "./ClassCalendarTab";
import { ClassInfoTab } from "./ClassInfoTab";
import { ClassStatusBadge } from "./ClassStatusBadge";
import { TraineeListTab } from "./TraineeListTab";

const CLASS_DETAIL_TABS = [
    { value: "info", label: "Class Info" },
    { value: "trainees", label: "Trainee List" },
    { value: "calendar", label: "Calendar" },
    { value: "budget", label: "Budget & Operation Info" },
    { value: "activities", label: "Activities" },
] as const;

export type ClassDetailTabValue = (typeof CLASS_DETAIL_TABS)[number]["value"];

const DEFAULT_TAB: ClassDetailTabValue = "trainees";

const isValidTab = (value: string | null): value is ClassDetailTabValue =>
    CLASS_DETAIL_TABS.some((tab) => tab.value === value);

const CLASS_LIST_PATH = "/classes";

type PendingNavigation =
    | { type: "tab"; tab: ClassDetailTabValue }
    | { type: "route"; to: string }
    | null;

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

export function ClassDetailView() {
    const params = useParams<{ classId?: string; classCode?: string }>();
    const rawIdentifier = (params.classCode ?? params.classId ?? "").trim();
    const identifier = /^[A-Za-z0-9_-]{1,64}$/.test(rawIdentifier) ? rawIdentifier : undefined;

    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const requestedTab = searchParams.get("tab");
    const activeTab: ClassDetailTabValue = isValidTab(requestedTab) ? requestedTab : DEFAULT_TAB;

    const [hasUnsavedTraineeChanges, setHasUnsavedTraineeChanges] = useState(false);
    const [calendarDirty, setCalendarDirty] = useState(false);
    const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation>(null);

    const query = useClasses({ classId: identifier ?? "" });
    const classItem = query.data;

    const listSearch = (location.state as { listSearch?: string } | null)?.listSearch;
    const backTo = listSearch ? `${CLASS_LIST_PATH}?${listSearch}` : CLASS_LIST_PATH;

    const resolvedName = classItem ? classTitle(classItem) : rawIdentifier;

    const navigateToTab = (tab: ClassDetailTabValue) => {
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("tab", tab);
        navigate({ pathname: location.pathname, search: `?${nextParams}`, hash: location.hash },
            { replace: true, state: location.state });
    };

    const handleTabChange = (nextValue: string) => {
        if (!isValidTab(nextValue) || nextValue === activeTab) return;

        if ((activeTab === "trainees" && hasUnsavedTraineeChanges) || (activeTab === "calendar" && calendarDirty)) {
            setPendingNavigation({ type: "tab", tab: nextValue });
            return;
        }

        navigateToTab(nextValue);
    };

    const handleBackLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
        if (activeTab === "trainees" && hasUnsavedTraineeChanges) {
            event.preventDefault();
            setPendingNavigation({ type: "route", to: backTo });
        }
    };

    const handleConfirmLeave = () => {
        if (!pendingNavigation) return;
        const target = pendingNavigation;
        setPendingNavigation(null);
        setHasUnsavedTraineeChanges(false);
        setCalendarDirty(false);

        if (target.type === "tab") {
            navigateToTab(target.tab);
        } else {
            navigate(target.to);
        }
    };

    return (
        <MainLayout
            pathName={{
                classes: "Class List",
                "training-operations": "Training Management",
                "training-management": "Training Management",
                "class-details": "Class Details",
                ...(identifier && resolvedName ? { [identifier]: resolvedName } : {}),
            }}
        >
            <section className="w-full min-w-0 flex-1 min-h-0 rounded-xl border bg-card text-card-foreground shadow-sm flex flex-col overflow-hidden">
                {!identifier ? (
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
                        {/* Header */}
                        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 pb-3">
                            <div className="flex flex-wrap items-center gap-2.5">
                                <h1 className="text-xl font-bold tracking-tight text-foreground">
                                    Class Details : {classTitle(classItem)}
                                </h1>
                                <ClassStatusBadge status={classItem.status} />
                                <TooltipWrapper
                                    content={`Current status: ${getClassStatusMeta(classItem.status).label}. Synchronized with FAMS Training Operations.`}
                                >
                                    <button
                                        type="button"
                                        aria-label="Class status information"
                                        className="inline-flex size-5 items-center justify-center rounded-full bg-amber-400 text-white transition-opacity hover:opacity-90 focus-visible:outline-2"
                                    >
                                        <HelpCircle className="size-3.5 stroke-[2.5]" aria-hidden />
                                    </button>
                                </TooltipWrapper>
                            </div>

                            <Link
                                to={backTo}
                                onClick={handleBackLinkClick}
                                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-blue-800 dark:hover:text-blue-300"
                            >
                                <ArrowLeft className="size-3.5" aria-hidden /> Back to Class List
                            </Link>
                        </header>

                        {/* Tabs Navigation */}
                        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col min-h-0 gap-0">
                            <TabsList
                                variant="line"
                                className="group-data-[orientation=horizontal]/tabs:h-11 w-full justify-start gap-4 overflow-x-auto overflow-y-hidden rounded-none border-b px-5 sm:gap-6"
                            >
                                {CLASS_DETAIL_TABS.map(({ value, label }) => (
                                    <TabsTrigger
                                        key={value}
                                        value={value}
                                        className="flex-none px-2 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground data-[state=active]:font-semibold data-[state=active]:text-[#283593] dark:data-[state=active]:text-blue-300 after:bottom-0 after:h-[2px] after:bg-[#283593] dark:after:bg-blue-400"
                                    >
                                        {label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>

                            <div
                                className={cn(
                                    "flex-1 min-h-0 p-4 sm:p-5",
                                    activeTab === "trainees"
                                        ? "flex flex-col overflow-hidden"
                                        : "overflow-y-auto fams-scrollbar",
                                )}
                            >
                                <TabsContent value="info">
                                    <ClassInfoTab classItem={classItem} onNavigate={handleTabChange} />
                                </TabsContent>

                                <TabsContent value="trainees" className="m-0 flex-1 min-h-0 flex flex-col">
                                    <TraineeListTab
                                        key={classItem.id}
                                        classItem={classItem}
                                        onDirtyChange={setHasUnsavedTraineeChanges}
                                    />
                                </TabsContent>

                                <TabsContent value="calendar">
                                    <ClassCalendarTab classItem={classItem} onDirtyChange={setCalendarDirty} />
                                </TabsContent>

                                <TabsContent value="budget">
                                    <ClassBudgetTab classItem={classItem} />
                                </TabsContent>

                                <TabsContent value="activities">
                                    <ClassActivitiesTab classItem={classItem} />
                                </TabsContent>
                            </div>
                        </Tabs>

                        {/* Unsaved Changes Leave Guard Modal */}
                        <Dialog
                            open={pendingNavigation !== null}
                            onOpenChange={(open) => !open && setPendingNavigation(null)}
                        >
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Unsaved Changes</DialogTitle>
                                    <DialogDescription>
                                        You have unsaved changes. Are you sure you want to leave?
                                    </DialogDescription>
                                </DialogHeader>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setPendingNavigation(null)}
                                    >
                                        Stay
                                    </Button>
                                    <Button type="button" variant="destructive" onClick={handleConfirmLeave}>
                                        Leave
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </>
                ) : null}
            </section>
        </MainLayout>
    );
}

export default ClassDetailView;
