import { useMemo, useState } from "react";
import { DropdownMenu } from "radix-ui";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, FileEdit, MoreVertical } from "lucide-react";
import TrainingCalendarAdjustDemo from "./TrainingCalendarAdjustDemo";
import type { DemoScheduleVersion, DemoVersionStatus } from "./training-calendar-demo.types";

// Danh sách mẫu độc lập: không gọi API và không đại diện cho phiên bản thật.
const DEMO_CLASSES = ["CLASS-01", "CLASS-02"];
const DEMO_VERSIONS: DemoScheduleVersion[] = [
  { id: "demo-1-v3", classId: "CLASS-01", versionNumber: 3, status: "DRAFT", note: "Update the training plan", updatedAt: "2026-10-21T09:00:00+07:00", updatedBy: "Demo coordinator" },
  { id: "demo-1-v2", classId: "CLASS-01", versionNumber: 2, status: "ACTIVE", note: "Published training calendar", updatedAt: "2026-10-20T14:00:00+07:00", updatedBy: "Demo coordinator" },
  { id: "demo-1-v1", classId: "CLASS-01", versionNumber: 1, status: "ARCHIVED", note: "Initial training plan", updatedAt: "2026-10-19T08:00:00+07:00", updatedBy: "Demo coordinator" },
  { id: "demo-2-v1", classId: "CLASS-02", versionNumber: 1, status: "DRAFT", note: "Initial draft for CLASS-02", updatedAt: "2026-10-21T10:00:00+07:00", updatedBy: "Demo coordinator" },
];
const STATUS_CLASSES: Record<DemoVersionStatus, string> = {
  DRAFT: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  ACTIVE: "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200",
  ARCHIVED: "border-border bg-muted text-muted-foreground",
};
const STATUS_LABELS: Record<DemoVersionStatus, string> = {
  DRAFT: "Draft", ACTIVE: "Active", ARCHIVED: "Archived",
};
const selectClass = "h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const itemClass = "flex cursor-pointer items-center gap-2 rounded-sm px-3 py-2 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground";

function calendarName(version: DemoScheduleVersion) {
  return `${version.classId}_TrainingCalendar_v${version.versionNumber}`;
}
function formatDate(value: string) {
  return new Date(value).toLocaleString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}
function StatusBadge({ status }: { status: DemoVersionStatus }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[status]}`}>{STATUS_LABELS[status]}</span>;
}

export default function TrainingCalendarDemoPage() {
  const [classId, setClassId] = useState(DEMO_CLASSES[0]);
  const [status, setStatus] = useState("ALL");
  const [detailVersion, setDetailVersion] = useState<DemoScheduleVersion | null>(null);
  const [adjustVersion, setAdjustVersion] = useState<DemoScheduleVersion | null>(null);

  const classVersions = useMemo(
    () => DEMO_VERSIONS.filter((version) => version.classId === classId).sort((a, b) => b.versionNumber - a.versionNumber),
    [classId],
  );
  const visibleVersions = classVersions.filter((version) => status === "ALL" || version.status === status);

  if (adjustVersion) {
    return <TrainingCalendarAdjustDemo version={adjustVersion} onBack={() => setAdjustVersion(null)} />;
  }

  return (
    <MainLayout pathName={{ "training-calendar": "Training Calendar", demo: "Demo" }}>
      <div className="mx-auto w-full max-w-7xl space-y-4 pb-6">
        <header className="border-b pb-3">
          <h1 className="text-xl font-semibold">Training Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">Class: {classId}</p>
        </header>
        <div role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <strong>UI demo.</strong> Classes, versions and training content are sample data. No server data is read or changed by this demo.
        </div>
        <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-card p-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">Class
            <select className={selectClass} value={classId} onChange={(event) => { setClassId(event.target.value); setStatus("ALL"); }}>
              {DEMO_CLASSES.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">Status
            <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ALL">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </label>
          <p role="status" className="ml-auto pb-2 text-sm text-muted-foreground">{visibleVersions.length} of {classVersions.length} versions</p>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-xs text-muted-foreground">
              <tr>{["No.", "Calendar name", "Change note", "Last modified date", "Last modified by", "Status", "Action"].map((label) => <th key={label} scope="col" className="px-3 py-3">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visibleVersions.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No matching sample versions.</td></tr>}
              {visibleVersions.map((version, index) => (
                <tr key={version.id} className="hover:bg-muted/30">
                  <td className="px-3 py-3 text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-3"><button type="button" className="break-words text-left font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setDetailVersion(version)}>{calendarName(version)}</button></td>
                  <td className="px-3 py-3">{version.note}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{formatDate(version.updatedAt)}</td>
                  <td className="px-3 py-3 text-muted-foreground">{version.updatedBy}</td>
                  <td className="px-3 py-3"><StatusBadge status={version.status} /></td>
                  <td className="px-3 py-3">
                    <DropdownMenu.Root>
                      <DropdownMenu.Trigger asChild>
                        <Button type="button" variant="ghost" size="sm" aria-label={`Actions for sample version ${version.versionNumber}`}><MoreVertical className="size-4" /></Button>
                      </DropdownMenu.Trigger>
                      <DropdownMenu.Portal>
                        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-48 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                          <DropdownMenu.Item className={itemClass} onSelect={() => setDetailVersion(version)}><Eye className="size-4" /> Version information</DropdownMenu.Item>
                          {version.status === "DRAFT" && <DropdownMenu.Item className={itemClass} onSelect={() => setAdjustVersion(version)}><FileEdit className="size-4" /> Adjust (demo)</DropdownMenu.Item>}
                        </DropdownMenu.Content>
                      </DropdownMenu.Portal>
                    </DropdownMenu.Root>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Dialog open={detailVersion !== null} onOpenChange={(open) => { if (!open) setDetailVersion(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Sample version information</DialogTitle><DialogDescription className="break-words">{detailVersion ? calendarName(detailVersion) : ""}</DialogDescription></DialogHeader>
          {detailVersion && <dl className="space-y-3 text-sm">
            {[["Class", detailVersion.classId], ["Version", String(detailVersion.versionNumber)], ["Last modified", formatDate(detailVersion.updatedAt)], ["Modified by", detailVersion.updatedBy], ["Change note", detailVersion.note]].map(([label, value]) => <div key={label} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b pb-2"><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{value}</dd></div>)}
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3"><dt className="text-muted-foreground">Status</dt><dd><StatusBadge status={detailVersion.status} /></dd></div>
          </dl>}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
