import { notificationApi } from "@/api";
import { notificationQueryKey } from "@/api/features/notification.api";
import { ApiErrorState } from "@/components/exam/ApiErrorState";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import type { NotificationCategory, NotificationDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BookOpen, CheckCheck, ClipboardCheck, FolderKanban, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  EXAM: "Exams",
  COURSE: "Courses",
  PROJECT: "Projects",
  SYSTEM: "System",
};
const CATEGORY_ICON = {
  EXAM: ClipboardCheck,
  COURSE: BookOpen,
  PROJECT: FolderKanban,
  SYSTEM: Bell,
} as const;
const CATEGORY_ORDER: NotificationCategory[] = ["EXAM", "COURSE", "PROJECT", "SYSTEM"];
const PAGE_SIZE = 15;

const categoryOf = (n: NotificationDTO): NotificationCategory => n.category ?? "SYSTEM";

function PreferencesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const account = user?.email ?? "signed-out";
  const preferencesKey = [...notificationQueryKey(account), "preferences"] as const;
  const preferences = useQuery({
    queryKey: preferencesKey,
    queryFn: notificationApi.getPreferences,
    enabled: open && account !== "signed-out",
  });
  const update = useMutation({
    mutationFn: (change: { category: NotificationCategory; inAppEnabled: boolean }) =>
      notificationApi.updatePreferences([change]),
    onSuccess: (rows) => {
      queryClient.setQueryData(preferencesKey, rows);
    },
    onError: () => toast.error("Could not save the setting"),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Notification settings</DialogTitle>
          <DialogDescription>
            Choose which kinds of notifications you receive. Turned-off kinds are not delivered to you at all.
          </DialogDescription>
        </DialogHeader>
        {preferences.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : preferences.isError ? (
          <p className="text-sm text-destructive">Could not load your settings.</p>
        ) : (
          <ul className="divide-y">
            {(preferences.data ?? []).map((pref) => (
              <li key={pref.category} className="flex items-center justify-between py-3">
                <span className="text-sm font-medium">{CATEGORY_LABEL[pref.category]}</span>
                <Switch
                  aria-label={`Receive ${CATEGORY_LABEL[pref.category]} notifications`}
                  checked={pref.inAppEnabled}
                  disabled={update.isPending}
                  onCheckedChange={(checked) => update.mutate({ category: pref.category, inAppEnabled: checked })}
                />
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function NotificationCenterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const account = user?.email ?? "signed-out";
  const [category, setCategory] = useState<NotificationCategory | undefined>();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const query = useQuery({
    queryKey: [...notificationQueryKey(account), "page", category ?? "ALL", unreadOnly, page],
    queryFn: () => notificationApi.getPage({ category, unreadOnly, page, size: PAGE_SIZE }),
    enabled: account !== "signed-out",
    refetchInterval: 10_000,
    placeholderData: (previous) => previous,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: notificationQueryKey(account) });
  const markRead = useMutation({ mutationFn: notificationApi.markRead, onSuccess: refresh });
  const markAllRead = useMutation({ mutationFn: notificationApi.markAllRead, onSuccess: refresh });
  const remove = useMutation({
    mutationFn: notificationApi.remove,
    onSuccess: () => {
      toast.success("Notification deleted");
      void refresh();
    },
    onError: () => toast.error("Could not delete the notification"),
  });
  const removeRead = useMutation({
    mutationFn: notificationApi.removeRead,
    onSuccess: (result) => {
      toast.success(`${result.deleted} read notification(s) deleted`);
      setPage(0);
      void refresh();
    },
    onError: () => toast.error("Could not delete read notifications"),
  });

  const data = query.data;
  const pick = (next: NotificationCategory | undefined) => {
    setCategory(next);
    setPage(0);
  };

  const open = (n: NotificationDTO) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.targetUrl?.startsWith("/")) navigate(n.targetUrl);
  };

  const total = data?.unreadCount ?? 0;
  const empty = !query.isLoading && data && data.items.length === 0;

  return (
    <MainLayout pathName={{ notifications: "Notifications" }}>
      <div className="w-full space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Notifications</h1>
            <p className="text-sm text-muted-foreground">
              {total > 0 ? `You have ${total} unread notification${total > 1 ? "s" : ""}.` : "You are all caught up."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!total || markAllRead.isPending} onClick={() => markAllRead.mutate()}>
              <CheckCheck className="mr-1 size-4" /> Mark all read
            </Button>
            <Button variant="outline" size="sm" disabled={removeRead.isPending} onClick={() => removeRead.mutate()}>
              <Trash2 className="mr-1 size-4" /> Clear read
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
              <Settings2 className="mr-1 size-4" /> Settings
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CATEGORY_ORDER.map((c) => {
            const unread = data?.unreadByCategory?.[c] ?? 0;
            const Icon = CATEGORY_ICON[c];
            return (
              <button
                key={c}
                type="button"
                onClick={() => pick(category === c ? undefined : c)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-accent",
                  category === c && "border-primary ring-1 ring-primary",
                )}
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className="size-5 text-muted-foreground" />
                </span>
                <span className="min-w-0">
                  <span className="block text-2xl font-semibold leading-none">{unread}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Unread · {CATEGORY_LABEL[c]}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div>
          <section className="flex min-h-[32rem] flex-col rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                {category ? CATEGORY_LABEL[category] : "All notifications"}
                {category && (
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => pick(undefined)}>
                    Clear filter
                  </Button>
                )}
              </div>
              <label className="flex items-center gap-2 text-sm">
                Unread only
                <Switch checked={unreadOnly} onCheckedChange={(v) => { setUnreadOnly(v); setPage(0); }} aria-label="Unread only" />
              </label>
            </div>
            {query.isError && !data ? (
              <div className="flex-1"><ApiErrorState error={query.error} onRetry={() => void query.refetch()} /></div>
            ) : query.isLoading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : empty ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
                <span className="flex size-16 items-center justify-center rounded-full bg-muted">
                  <Bell className="size-8 text-muted-foreground" />
                </span>
                <h2 className="text-lg font-semibold">
                  {unreadOnly || category ? "Nothing matches this filter" : "No notifications yet"}
                </h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {unreadOnly || category
                    ? "Try another category or turn off “Unread only”."
                    : "Exam results, course updates and project deadlines will show up here as they happen."}
                </p>
                <div className="flex gap-2">
                  {(unreadOnly || category) && (
                    <Button size="sm" onClick={() => { setUnreadOnly(false); pick(undefined); }}>Show everything</Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
                    <Settings2 className="mr-1 size-4" /> Notification settings
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="flex-1 divide-y">
                {data?.items.map((n) => (
                  <li key={n.id} className={cn("flex items-start gap-3 px-5 py-4", !n.read && "bg-blue-50/70 dark:bg-blue-950/20")}>
                    <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-blue-600")} />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open(n)}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{n.title}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                          {CATEGORY_LABEL[categoryOf(n)]}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{n.message}</span>
                      <span className="mt-1 block text-[11px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete notification"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(n.id)}
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {data && data.totalPages > 1 && (
              <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
                <span className="text-muted-foreground">Page {data.page + 1} of {data.totalPages}</span>
                <Button variant="outline" size="sm" disabled={page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            )}
          </section>
        </div>
      </div>
      <PreferencesDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </MainLayout>
  );
}
