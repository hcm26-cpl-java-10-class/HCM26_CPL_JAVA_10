import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { classSetupApi, type TeachingAssignment } from "@/api/features/class-setup.api";
import type { PreviewSessionItemDTO } from "@/types/features/schedule-generation";
import { Button } from "@/components/ui/button";

export function AssignmentPicker({ classId, row, onSelect, disabled }: {
  classId: number; row: PreviewSessionItemDTO; onSelect: (assignment: TeachingAssignment) => void; disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const query = useQuery({ queryKey: ["available-assignments", classId, row.programSubjectId, row.startTime, row.endTime],
    enabled: editing && Boolean(row.programSubjectId), retry: 1,
    queryFn: ({ signal }) => classSetupApi.getAvailableAssignments(classId, { programSubjectId: row.programSubjectId, from: row.startTime, to: row.endTime }, signal),
  });
  return <div className="space-y-1">
    {!editing ? <><p className="text-xs">{row.trainerName || "No assignment selected"}</p><Button type="button" size="sm" variant="outline" disabled={disabled || !row.programSubjectId} onClick={() => setEditing(true)}>Choose assignment</Button></>
      : <select aria-label={`Assignment for ${row.title}`} className="h-9 w-full rounded-md border bg-background px-2 text-xs" disabled={disabled || query.isFetching} value={row.teachingAssignmentId || ""} onChange={(event) => {
        const assignment = query.data?.find((item) => item.id === Number(event.target.value)); if (assignment) onSelect(assignment);
      }}><option value="">{query.isFetching ? "Loading assignments..." : "Select assignment"}</option>
        {row.teachingAssignmentId && !query.data?.some((item) => item.id === row.teachingAssignmentId) && <option value={row.teachingAssignmentId} disabled>{row.trainerName || "Current assignment"} (reload required)</option>}
        {query.data?.map((item) => <option key={item.id} value={item.id}>{item.trainerName || `Trainer ${item.trainerId}`} · {item.role}</option>)}
      </select>}
    {query.isError && <p role="alert" className="text-xs text-destructive">Unable to load assignments. <button type="button" className="underline" onClick={() => void query.refetch()}>Retry</button></p>}
    {editing && query.isSuccess && !query.data.length && <p className="text-xs text-destructive">No assignment covers this session.</p>}
  </div>;
}
