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
import { cn } from "@/lib/utils";
import type { NotificationCategory, NotificationDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Settings2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  EXAM: "Exams",
  COURSE: "Courses",
  PROJECT: "Projects",
  SYSTEM: "System",
};
const CATEGORY_ORDER: NotificationCategory[] = ["EXAM", "COURSE", "PROJECT", "SYSTEM"];
const PAGE_SIZE = 15;

const categoryOf = (n: NotificationDTO): NotificationCategory => n.category ?? "SYSTEM";

function PreferencesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const preferences = useQuery({
    queryKey: [...notificationQueryKey, "preferences"],
    queryFn: notificationApi.getPreferences,
    enabled: open,
  });
  const update = useMutation({
    mutationFn: (change: { category: NotificationCategory; inAppEnabled: boolean }) =>
      notificationApi.updatePreferences([change]),
    onSuccess: (rows) => {
      queryClient.setQueryData([...notificationQueryKey, "preferences"], rows);
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
  const [category, setCategory] = useState<NotificationCategory | undefined>();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const query = useQuery({
    queryKey: [...notificationQueryKey, "page", category ?? "ALL", unreadOnly, page],
    queryFn: () => notificationApi.getPage({ category, unreadOnly, page, size: PAGE_SIZE }),
    refetchInterval: 10_000,
    placeholderData: (previous) => previous,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: notificationQueryKey });
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

  return (
    <MainLayout pathName={{ notifications: "Notifications" }}>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold">Notifications</h1>
            <p className="text-sm text-muted-foreground">{data?.unreadCount ?? 0} unread</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!data?.unreadCount || markAllRead.isPending} onClick={() => markAllRead.mutate()}>
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

        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Notification filters">
          <Button size="sm" variant={category === undefined ? "default" : "outline"} onClick={() => pick(undefined)}>
            All
          </Button>
          {CATEGORY_ORDER.map((c) => {
            const unread = data?.unreadByCategory?.[c] ?? 0;
            return (
              <Button key={c} size="sm" variant={category === c ? "default" : "outline"} onClick={() => pick(c)}>
                {CATEGORY_LABEL[c]}
                {unread > 0 && (
                  <span className="ml-1.5 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-4 text-white">{unread}</span>
                )}
              </Button>
            );
          })}
          <label className="ml-auto flex items-center gap-2 text-sm">
            <Switch checked={unreadOnly} onCheckedChange={(v) => { setUnreadOnly(v); setPage(0); }} aria-label="Unread only" />
            Unread only
          </label>
        </div>

        {query.isError && !data ? (
          <ApiErrorState error={query.error} onRetry={() => void query.refetch()} />
        ) : query.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : data && data.items.length > 0 ? (
          <ul className="divide-y rounded-lg border">
            {data.items.map((n) => (
              <li key={n.id} className={cn("flex items-start gap-3 px-4 py-3", !n.read && "bg-blue-50/70 dark:bg-blue-950/20")}>
                <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-blue-600")} />
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open(n)}>
                  <span className="flex items-center gap-2">
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
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            <Bell className="size-6" />
            {unreadOnly || category ? "No notifications match this filter." : "You have no notifications yet."}
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
            <span className="text-muted-foreground">Page {data.page + 1} of {data.totalPages}</span>
            <Button variant="outline" size="sm" disabled={page + 1 >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>
      <PreferencesDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </MainLayout>
  );
}
