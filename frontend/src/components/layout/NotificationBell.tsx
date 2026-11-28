import { notificationApi } from "@/api";
import { notificationQueryKey } from "@/api/features/notification.api";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingInvitations } from "@/hooks/usePendingInvitations";
import { cn } from "@/lib/utils";
import type { NotificationDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, ChevronLeft, ChevronRight, FileClock, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

type RetryAction = { kind: "one"; notification: NotificationDTO } | { kind: "all" };

function toastedInvitationIds(account: string): number[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`student_invitation_toasted_ids:${account}`) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is number => typeof id === "number") : [];
  } catch {
    return [];
  }
}

export function NotificationBell() {
  const { user } = useAuth();
  const account = user?.email ?? "signed-out";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [retryAction, setRetryAction] = useState<RetryAction | null>(null);
  const invitations = usePendingInvitations();
  const previousInvitationCount = useRef<number | null>(null);
  const queryKey = notificationQueryKey(account);

  useEffect(() => {
    const previous = previousInvitationCount.current;
    if (previous !== null && invitations.count > previous) {
      const stored = toastedInvitationIds(account);
      const fresh = invitations.pending.filter(item => item.id != null && !stored.includes(item.id));
      if (fresh.length) {
        toast.info(fresh.length === 1 ? "You have a new exam invitation" : `You have ${fresh.length} new exam invitations`);
        try {
          localStorage.setItem(`student_invitation_toasted_ids:${account}`, JSON.stringify([...stored, ...fresh.flatMap(item => item.id == null ? [] : [item.id])]));
        } catch { /* Storage can be unavailable. */ }
      }
    }
    previousInvitationCount.current = invitations.count;
  }, [account, invitations.count, invitations.pending]);

  const notificationsQuery = useQuery({
    queryKey: [...queryKey, page],
    queryFn: () => notificationApi.getMine(page),
    enabled: account !== "signed-out",
    refetchInterval: 5_000,
  });

  const refreshHistory = () => queryClient.invalidateQueries({ queryKey });
  const goTo = (targetUrl?: string) => {
    if (targetUrl?.startsWith("/")) navigate(targetUrl);
    setOpen(false);
  };
  const markRead = useMutation({
    mutationFn: async (notification: NotificationDTO) => {
      await notificationApi.markRead(notification.id);
      return notification;
    },
    onSuccess: async (notification) => {
      setRetryAction(null);
      await refreshHistory();
      goTo(notification.targetUrl);
    },
    onError: (_error, notification) => setRetryAction({ kind: "one", notification }),
  });
  const markAllRead = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: async () => {
      setRetryAction(null);
      await refreshHistory();
    },
    onError: () => setRetryAction({ kind: "all" }),
  });

  const data = notificationsQuery.data;
  const unreadCount = data?.unreadCount ?? 0;
  const badgeCount = unreadCount || invitations.count;
  const openNotification = (notification: NotificationDTO) => {
    setRetryAction(null);
    if (notification.read) goTo(notification.targetUrl);
    else markRead.mutate(notification);
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) void notificationsQuery.refetch(); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="relative text-muted-foreground"
          aria-label={`Notifications: ${unreadCount} unread; exam invitations: ${invitations.count} pending`}
        >
          <Bell className="size-4" />
          {badgeCount > 0 && <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-slate-900 px-1 text-[10px] font-semibold leading-4 text-white dark:bg-slate-100 dark:text-slate-900">{badgeCount > 99 ? "99+" : badgeCount}</span>}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(25rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div><h2 className="font-semibold">Notifications</h2><p className="text-xs text-muted-foreground">{unreadCount} unread</p></div>
          {unreadCount > 0 && <Button type="button" variant="ghost" size="sm" className="gap-1.5" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}><CheckCheck className="size-4" /> Mark all read</Button>}
        </div>

        <button type="button" className="flex w-full items-center gap-3 border-b px-4 py-3 text-left hover:bg-accent" onClick={() => goTo("/invitations")}>
          <FileClock className="size-5 text-slate-700 dark:text-slate-300" />
          <span className="min-w-0 flex-1"><span className="block text-sm font-medium">Exam invitations</span><span className="block text-xs text-muted-foreground">{invitations.isError ? "Could not refresh invitations" : `${invitations.count} pending invitation${invitations.count === 1 ? "" : "s"}`}</span></span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </button>

        {retryAction && <div role="alert" className="flex items-center justify-between gap-3 border-b bg-slate-100 px-4 py-2 text-sm text-slate-900 dark:bg-slate-900 dark:text-slate-100"><span>Could not update notification status.</span><Button type="button" size="sm" variant="outline" onClick={() => retryAction.kind === "all" ? markAllRead.mutate() : markRead.mutate(retryAction.notification)}><RotateCcw className="mr-1 size-3" /> Retry</Button></div>}

        <div className="max-h-80 overflow-y-auto">
          {notificationsQuery.isLoading ? <p className="p-6 text-center text-sm text-muted-foreground">Loading notifications...</p>
            : notificationsQuery.isError ? <div className="space-y-3 p-6 text-center"><p className="text-sm text-slate-700 dark:text-slate-300">Could not load notifications.</p><Button variant="outline" size="sm" onClick={() => void notificationsQuery.refetch()}>Try again</Button></div>
            : data?.items.length ? data.items.map(notification => <button key={notification.id} type="button" className={cn("flex w-full gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent", !notification.read && "bg-slate-100/80 dark:bg-slate-800/60")} onClick={() => openNotification(notification)}>
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", notification.read ? "bg-transparent" : "bg-slate-900 dark:bg-slate-100")} />
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{notification.title}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{notification.message}</span><span className="mt-1 block text-[11px] text-muted-foreground">{new Date(notification.createdAt).toLocaleString()}</span></span>
            </button>)
              : <p className="p-8 text-center text-sm text-muted-foreground">No notifications on this page.</p>}
        </div>
        {(data?.totalPages ?? 0) > 1 && <nav aria-label="Notification history pages" className="flex items-center justify-between border-t px-3 py-2">
          <Button type="button" size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(current => Math.max(0, current - 1))}><ChevronLeft className="mr-1 size-4" /> Newer</Button>
          <span className="text-xs text-muted-foreground">Page {page + 1} of {data?.totalPages}</span>
          <Button type="button" size="sm" variant="ghost" disabled={page + 1 >= (data?.totalPages ?? 0)} onClick={() => setPage(current => current + 1)}>Older <ChevronRight className="ml-1 size-4" /></Button>
        </nav>}
        <div className="border-t p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => {
              setOpen(false);
              navigate("/notifications");
            }}
          >
            View all notifications
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
