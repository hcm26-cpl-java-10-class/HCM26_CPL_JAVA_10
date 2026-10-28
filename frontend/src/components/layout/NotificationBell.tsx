import { notificationApi } from "@/api";
import { notificationQueryKey } from "@/api/features/notification.api";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { NotificationDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const notificationsQuery = useQuery({
    queryKey: notificationQueryKey,
    queryFn: notificationApi.getMine,
    refetchInterval: 5_000,
  });

  const markRead = useMutation({
    mutationFn: async ({ id, targetUrl }: { id: number; targetUrl?: string }) => {
      await notificationApi.markRead(id);
      return targetUrl;
    },
    onSuccess: async (targetUrl) => {
      await queryClient.invalidateQueries({ queryKey: notificationQueryKey });
      if (targetUrl?.startsWith("/")) {
        navigate(targetUrl);
      }
    },
  });

  const markAllRead = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationQueryKey }),
  });

  const data = notificationsQuery.data;
  const unreadCount = data?.unreadCount ?? 0;

  const openNotification = (notification: NotificationDTO) => {
    if (notification.read) {
      if (notification.targetUrl?.startsWith("/")) {
        navigate(notification.targetUrl);
      }
      return;
    }
    markRead.mutate({ id: notification.id, targetUrl: notification.targetUrl });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) void notificationsQuery.refetch();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="relative text-muted-foreground"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-2rem))] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 className="font-semibold">Notifications</h2>
            <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
          </div>
          {unreadCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1.5"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="size-4" /> Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {notificationsQuery.isLoading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Loading notifications...</p>
          ) : notificationsQuery.isError ? (
            <div className="space-y-3 p-6 text-center">
              <p className="text-sm text-destructive">Could not load notifications.</p>
              <Button variant="outline" size="sm" onClick={() => void notificationsQuery.refetch()}>
                Try again
              </Button>
            </div>
          ) : data?.items.length ? (
            data.items.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className={cn(
                  "flex w-full gap-3 border-b px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent",
                  !notification.read && "bg-blue-50/70 dark:bg-blue-950/20",
                )}
                onClick={() => openNotification(notification)}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    notification.read ? "bg-transparent" : "bg-blue-600",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{notification.title}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                    {notification.message}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {new Date(notification.createdAt).toLocaleString()}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="p-8 text-center text-sm text-muted-foreground">No notifications yet.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

