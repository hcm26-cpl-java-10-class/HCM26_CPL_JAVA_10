import { subjectApi } from "@/api/features/subject.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { SubjectDTO } from "@/types/features/subject";
import { useQuery } from "@tanstack/react-query";
import { subjectError } from "./subject-errors";

interface Props {
  id: number | null;
  onClose: () => void;
  onEdit?: (subject: SubjectDTO) => void;
  onClone?: (subject: SubjectDTO) => void;
}

export function SubjectDetailSheet({ id, onClose, onEdit, onClone }: Props) {
  const detail = useQuery({ queryKey: ["subject-detail", id], queryFn: () => subjectApi.getById(String(id)), enabled: id !== null, staleTime: 0 });
  const usage = useQuery({ queryKey: ["subject-usage", id], queryFn: () => subjectApi.getUsage(id!), enabled: id !== null, staleTime: 0 });
  const subject = detail.data;
  return (
    <Sheet open={id !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader className="border-b">
          <SheetTitle>{subject?.name ?? "Subject details"}</SheetTitle>
          <SheetDescription>{subject ? `${subject.code} · Version ${subject.version}` : "Subject information and usage."}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {detail.isPending && <p role="status" className="text-sm text-muted-foreground">Loading subject...</p>}
          {detail.isError && <div role="alert" className="space-y-2 text-sm text-destructive">
            <p>{subjectError(detail.error, "Unable to load this subject.")}</p>
            <Button variant="outline" onClick={() => void detail.refetch()}>Retry</Button>
          </div>}
          {subject && <>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-muted-foreground">Technical group</dt><dd className="mt-1 font-medium">{subject.technicalGroup || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Hours</dt><dd className="mt-1 font-medium">{subject.durationHours}</dd></div>
              <div><dt className="text-muted-foreground">Delivery mode</dt><dd className="mt-1 font-medium">{subject.deliveryMode?.toLowerCase() || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Status</dt><dd className="mt-1"><Badge variant={subject.isActive ? "default" : "secondary"}>{subject.isActive ? "Active" : "Inactive"}</Badge></dd></div>
            </dl>
            {([ ["Description", subject.description], ["Objectives", subject.objectives], ["Skills", subject.skills], ["Outline", subject.outline] ] as const).map(([label, value]) => (
              <section key={label} className="space-y-2 border-t pt-4"><h2 className="text-sm font-semibold">{label}</h2><p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{value || "Not specified"}</p></section>
            ))}
            <section className="space-y-3 border-t pt-4">
              <h2 className="text-sm font-semibold">Usage of this version</h2>
              {usage.isPending && <p role="status" className="text-sm text-muted-foreground">Loading usage...</p>}
              {usage.isError && <div role="alert" className="space-y-2 text-sm"><p>Unable to load usage.</p><Button size="sm" variant="outline" onClick={() => void usage.refetch()}>Retry</Button></div>}
              {usage.data && <>
                <dl className="grid grid-cols-2 gap-3 text-sm">{[
                  ["Program entries", usage.data.programSubjects], ["Teaching assignments", usage.data.teachingAssignments],
                  ["Sessions", usage.data.sessions], ["Study sessions", usage.data.studySessions],
                ].map(([label, count]) => <div key={label} className="rounded-lg border p-3"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 text-lg font-semibold">{count}</dd></div>)}</dl>
                <p className="text-sm text-muted-foreground">{usage.data.referenced ? "Content is protected because this version is in use. Clone it to make changes." : "This version has no references and its content can be edited."}</p>
              </>}
            </section>
          </>}
        </div>
        <SheetFooter className="border-t sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
          {subject && onClone && <Button variant="outline" onClick={() => onClone(subject)}>Clone version</Button>}
          {subject && onEdit && <Button onClick={() => onEdit(subject)}>Edit subject</Button>}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
