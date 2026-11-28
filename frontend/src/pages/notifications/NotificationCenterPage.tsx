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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import type {
  NotificationCategory,
  NotificationDTO,
  NotificationPreferenceDTO,
  TenantNotificationPolicyDTO,
} from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BookOpen,
  Calendar,
  CheckCheck,
  ClipboardCheck,
  FolderKanban,
  Settings2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  EXAM: "Exams",
  COURSE: "Courses",
  PROJECT: "Projects",
  CLASS: "Classes",
  SYSTEM: "System",
};
const CATEGORY_ICON = {
  EXAM: ClipboardCheck,
  COURSE: BookOpen,
  PROJECT: FolderKanban,
  CLASS: Calendar,
  SYSTEM: Bell,
} as const;
const CATEGORY_ORDER: NotificationCategory[] = ["EXAM", "COURSE", "PROJECT", "CLASS", "SYSTEM"];
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
    mutationFn: (change: NotificationPreferenceDTO) => notificationApi.updatePreferences([change]),
    onSuccess: (rows) => {
      queryClient.setQueryData(preferencesKey, rows);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not save the setting");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-xl p-0">
        <DialogHeader className="sticky top-0 border-b bg-background px-6 py-4">
          <DialogTitle>Notification settings</DialogTitle>
          <DialogDescription>
            Configure In-App and Email channels per category. Mandatory policies enforced by your organization cannot be turned off.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto px-6 py-4">
          {preferences.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : preferences.isError ? (
            <p className="text-sm text-slate-700 dark:text-slate-300">Could not load your settings.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-6 border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Category</span>
                <span className="w-20 text-center">In-App</span>
                <span className="w-20 text-center">Email</span>
              </div>
              <ul className="divide-y">
                {(preferences.data ?? []).map((pref) => {
                  const emailEnabled = pref.emailEnabled ?? true;
                  const inAppLocked = Boolean(pref.inAppMandatory);
                  const emailLocked = Boolean(pref.emailMandatory);
                  return (
                    <li key={pref.category} className="grid grid-cols-[1fr_auto_auto] items-center gap-6 py-3">
                      <div className="min-w-0">
                        <span className="text-sm font-medium">{CATEGORY_LABEL[pref.category]}</span>
                        {(inAppLocked || emailLocked) && (
                          <span className="ml-2 inline-flex items-center rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium text-white dark:bg-slate-100 dark:text-slate-900">
                            Policy
                          </span>
                        )}
                      </div>
                      <div className="flex w-20 flex-col items-center gap-1">
                        <Switch
                          aria-label={`Receive ${CATEGORY_LABEL[pref.category]} in-app notifications`}
                          checked={inAppLocked ? true : pref.inAppEnabled}
                          disabled={update.isPending || inAppLocked}
                          onCheckedChange={(checked) =>
                            update.mutate({
                              category: pref.category,
                              inAppEnabled: checked,
                              emailEnabled,
                            })
                          }
                        />
                        {inAppLocked && <span className="text-[10px] text-muted-foreground">Required</span>}
                      </div>
                      <div className="flex w-20 flex-col items-center gap-1">
                        <Switch
                          aria-label={`Receive ${CATEGORY_LABEL[pref.category]} email notifications`}
                          checked={emailLocked ? true : emailEnabled}
                          disabled={update.isPending || emailLocked}
                          onCheckedChange={(checked) =>
                            update.mutate({
                              category: pref.category,
                              inAppEnabled: pref.inAppEnabled,
                              emailEnabled: checked,
                            })
                          }
                        />
                        {emailLocked && <span className="text-[10px] text-muted-foreground">Required</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 flex justify-end border-t bg-background px-6 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TenantPoliciesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const account = user?.email ?? "signed-out";
  const policiesKey = [...notificationQueryKey(account), "policies"] as const;
  const preferencesKey = [...notificationQueryKey(account), "preferences"] as const;
  const [drafts, setDrafts] = useState<Record<string, TenantNotificationPolicyDTO>>({});

  const policies = useQuery({
    queryKey: policiesKey,
    queryFn: notificationApi.getPolicies,
    enabled: open && account !== "signed-out",
  });

  const save = useMutation({
    mutationFn: (changes: TenantNotificationPolicyDTO[]) => notificationApi.updatePolicies(changes),
    onSuccess: (rows) => {
      queryClient.setQueryData(policiesKey, rows);
      void queryClient.invalidateQueries({ queryKey: preferencesKey });
      setDrafts({});
      toast.success("Tenant notification policies saved");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not update policies");
    },
  });

  const rows = (policies.data ?? []).map((row) => drafts[row.category] ?? row);

  const patchRow = (category: NotificationCategory, patch: Partial<TenantNotificationPolicyDTO>) => {
    const base = rows.find((r) => r.category === category);
    if (!base) return;
    setDrafts((prev) => ({ ...prev, [category]: { ...base, ...patch } }));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-3xl p-0">
        <DialogHeader className="sticky top-0 border-b bg-background px-6 py-4">
          <DialogTitle>Tenant Notification Policies</DialogTitle>
          <DialogDescription>
            Lock mandatory notification channels and configure deduplication cooldown windows for all users in this tenant.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto px-6 py-4">
          {policies.isLoading ? (
            <Skeleton className="h-44 w-full" />
          ) : policies.isError ? (
            <p className="text-sm text-slate-700 dark:text-slate-300">Could not load tenant policies.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-6 border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span>Category</span>
                <span className="w-24 text-center">Lock In-App</span>
                <span className="w-24 text-center">Lock Email</span>
                <span className="w-28 text-center">Cooldown (min)</span>
              </div>
              <ul className="divide-y">
                {rows.map((row) => (
                  <li key={row.category} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-6 py-3">
                    <span className="text-sm font-medium">{CATEGORY_LABEL[row.category]}</span>
                    <div className="flex w-24 justify-center">
                      <Switch
                        aria-label={`Lock ${CATEGORY_LABEL[row.category]} in-app`}
                        checked={row.inAppMandatory}
                        disabled={save.isPending}
                        onCheckedChange={(checked) => patchRow(row.category, { inAppMandatory: checked })}
                      />
                    </div>
                    <div className="flex w-24 justify-center">
                      <Switch
                        aria-label={`Lock ${CATEGORY_LABEL[row.category]} email`}
                        checked={row.emailMandatory}
                        disabled={save.isPending}
                        onCheckedChange={(checked) => patchRow(row.category, { emailMandatory: checked })}
                      />
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        min={0}
                        max={10080}
                        value={row.cooldownMinutes}
                        disabled={save.isPending}
                        onChange={(e) => {
                          const parsed = Number.parseInt(e.target.value, 10);
                          patchRow(row.category, { cooldownMinutes: Number.isNaN(parsed) ? 0 : Math.max(0, parsed) });
                        }}
                        className="h-8 text-center"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 flex justify-end gap-2 border-t bg-background px-6 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            disabled={save.isPending || policies.isLoading || rows.length === 0}
            onClick={() => save.mutate(rows)}
          >
            Save policies
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function NotificationCenterPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canManagePolicies = hasPermission("NOTIFICATION_POLICY_MANAGE");
  const account = user?.email ?? "signed-out";
  const [category, setCategory] = useState<NotificationCategory | undefined>();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [policiesOpen, setPoliciesOpen] = useState(false);

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
            {canManagePolicies && (
              <Button
                size="sm"
                className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
                onClick={() => setPoliciesOpen(true)}
              >
                <ShieldCheck className="mr-1 size-4" /> Tenant policies
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
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
                  category === c && "border-slate-900 ring-1 ring-slate-900 dark:border-slate-100 dark:ring-slate-100",
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
                    : "Exam results, course updates, class schedules and project deadlines will show up here as they happen."}
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
                  <li key={n.id} className={cn("flex items-start gap-3 px-5 py-4", !n.read && "bg-slate-100/80 dark:bg-slate-800/60")}>
                    <span className={cn("mt-2 size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-slate-900 dark:bg-slate-100")} />
                    <button type="button" className="min-w-0 flex-1 text-left" onClick={() => open(n)}>
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{n.title}</span>
                        <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium uppercase text-white dark:bg-slate-100 dark:text-slate-900">
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
      {canManagePolicies && <TenantPoliciesDialog open={policiesOpen} onClose={() => setPoliciesOpen(false)} />}
    </MainLayout>
  );
}
