import { notificationApi } from "@/api";
import { ApiErrorState } from "@/components/exam/ApiErrorState";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { NotificationCategory, TenantNotificationPolicyDTO } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
  EXAM: "Exams & Assessments",
  COURSE: "Courses & Learning",
  PROJECT: "Mock Project Hub",
  CLASS: "Classes & Schedules",
  SYSTEM: "System & Security",
};

export default function NotificationPoliciesPage() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, TenantNotificationPolicyDTO>>({});

  const query = useQuery({
    queryKey: ["tenant-notification-policies"],
    queryFn: notificationApi.getPolicies,
  });

  const saveMutation = useMutation({
    mutationFn: notificationApi.updatePolicies,
    onSuccess: (rows) => {
      queryClient.setQueryData(["tenant-notification-policies"], rows);
      setDrafts({});
      toast.success("Tenant notification policies updated");
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message || "Could not update tenant policies");
    },
  });

  const rows = (query.data ?? []).map((row) => drafts[row.category] ?? row);

  const patchRow = (category: NotificationCategory, patch: Partial<TenantNotificationPolicyDTO>) => {
    const base = rows.find((r) => r.category === category);
    if (!base) return;
    setDrafts((prev) => ({ ...prev, [category]: { ...base, ...patch } }));
  };

  return (
    <MainLayout pathName={{ communications: "Communications", policies: "Notification Policies" }}>
      <div className="w-full space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Notification Policies</h1>
            <p className="text-sm text-muted-foreground">
              Enforce mandatory In-App/Email channels and deduplication cooldown windows across the tenant.
            </p>
          </div>
          <Button
            size="sm"
            className="bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            disabled={saveMutation.isPending || query.isLoading || rows.length === 0}
            onClick={() => saveMutation.mutate(rows)}
          >
            <ShieldCheck className="mr-1 size-4" /> Save Policies
          </Button>
        </div>

        <section className="rounded-xl border bg-card p-5">
          {query.isError && !query.data ? (
            <ApiErrorState error={query.error} onRetry={() => void query.refetch()} />
          ) : query.isLoading ? (
            <Skeleton className="h-56 w-full" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3 text-center">Lock In-App</th>
                    <th className="px-4 py-3 text-center">Lock Email</th>
                    <th className="px-4 py-3 text-center">Cooldown (minutes)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={row.category}>
                      <td className="px-4 py-3.5 font-medium">{CATEGORY_LABEL[row.category]}</td>
                      <td className="px-4 py-3.5 text-center">
                        <Switch
                          aria-label={`Lock ${row.category} in-app`}
                          checked={row.inAppMandatory}
                          disabled={saveMutation.isPending}
                          onCheckedChange={(checked) => patchRow(row.category, { inAppMandatory: checked })}
                        />
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Switch
                          aria-label={`Lock ${row.category} email`}
                          checked={row.emailMandatory}
                          disabled={saveMutation.isPending}
                          onCheckedChange={(checked) => patchRow(row.category, { emailMandatory: checked })}
                        />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="mx-auto w-28">
                          <Input
                            type="number"
                            min={0}
                            max={10080}
                            value={row.cooldownMinutes}
                            disabled={saveMutation.isPending}
                            onChange={(e) => {
                              const parsed = Number.parseInt(e.target.value, 10);
                              patchRow(row.category, {
                                cooldownMinutes: Number.isNaN(parsed) ? 0 : Math.max(0, parsed),
                              });
                            }}
                            className="h-8 text-center"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
