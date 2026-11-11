import { subjectApi, technicalGroupQueryKey } from "@/api/features/subject.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProTable } from "@/components/datatable/ProTable";
import { useProTable } from "@/components/datatable/hook/useProTable";
import ActionButton from "@/components/datatable/common/ActionButton";
import { ExportModal } from "@/components/datatable/dataio/ExportModal";
import { downloadBlob, getFilenameFromHeader } from "@/components/datatable/util/dataio.utils";
import { Button } from "@/components/ui/button";
import type { EntityConfig, FileFormat, SortEntry } from "@/types";
import type { SubjectDTO } from "@/types/features/subject";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Eye, Pen, Plus, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SubjectPageHeader } from "./SubjectPageHeader";
import { SubjectCloneDialog } from "./SubjectCloneDialog";
import { SubjectDeleteDialog } from "./SubjectDeleteDialog";
import { SubjectDetailSheet } from "./SubjectDetailSheet";
import { SubjectForm } from "./SubjectForm";
import { SubjectImportDialog } from "./SubjectImportDialog";
import { subjectSchema } from "./subject-schema";
import { subjectError } from "./subject-errors";

export const entityConfig: EntityConfig = {
  name: "Subjects", path: "/subjects", api: subjectApi, schema: subjectSchema,
};

export default function SubjectsPage() {
  const client = useQueryClient();
  const groups = useQuery({ queryKey: technicalGroupQueryKey, queryFn: subjectApi.getTechnicalGroups });
  const schema = useMemo(() => ({
    ...subjectSchema,
    fields: subjectSchema.fields.map((field) => field.name === "technicalGroup"
      ? { ...field, options: (groups.data ?? []).map((name) => ({label: name, value: name})),
          filterOptions: (groups.data ?? []).map((name) => ({label: name, value: name})) }
      : field),
  }), [groups.data]);
  // Subjects owns its preview import/export UI; all other table behavior stays shared.
  const table = useProTable(subjectApi, schema, {permissionOverrides: {canImport: false, canExport: false}});
  const [detailId, setDetailId] = useState<number | null>(null);
  const [cloneSubject, setCloneSubject] = useState<SubjectDTO | null>(null);
  const [deleteSubject, setDeleteSubject] = useState<SubjectDTO | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const canClone = table.permission.canRead && table.permission.canCreate;
  const refresh = () => {
    for (const key of ["subject", "subject-detail", "subject-usage", "subject-technical-groups"]) {
      void client.invalidateQueries({queryKey: [key]});
    }
  };
  const changeStatus = useMutation({mutationFn: ({id, active}: {id: number; active: boolean}) => subjectApi.changeStatus(id, active),
    onSuccess: () => { refresh(); toast.success("Subject status updated."); },
    onError: (error) => toast.error(subjectError(error, "Unable to update subject status."))});
  const startClone = (subject: SubjectDTO) => { table.setFormOpen(false); setDetailId(null); setCloneSubject(subject); };
  const openEdit = (subject: SubjectDTO) => { setDetailId(null); table.openEdit(subject); };
  const exportFile = async (format: FileFormat) => {
    const sort = table.sortState.map((entry: SortEntry) => `${entry.field},${entry.direction}`);
    const response = await subjectApi.exportFiltered(format, table.search, table.filters, sort);
    downloadBlob(response.data, getFilenameFromHeader(response.headers["content-disposition"]) ?? undefined);
  };
  const shownTable = {...table,
    setFilters: (next: Parameters<typeof table.setFilters>[0]) => { table.setPage(0); table.setFilters(next); },
    clearFilters: () => { table.setPage(0); table.clearFilters(); },
    setSearch: (value: string) => { table.setPage(0); table.setSearch(value); },
    toggleSort: (name: string) => { table.setPage(0); table.toggleSort(name); },
    clearSort: () => { table.setPage(0); table.clearSort(); },
    patchField: (id: number, name: string, value: boolean) => {
    if (name === "isActive" && table.permission.canUpdate && !changeStatus.isPending) changeStatus.mutate({id, active: value});
  }};
  return (
    <MainLayout pathName={{subjects: "Subjects"}}>
      <div className="mb-5 shrink-0">
        <SubjectPageHeader action={table.isFormOpen ? table.editingRow ? "Edit Subject" : "Create Subject" : null}
          onBackToList={() => table.setFormOpen(false)} />
      </div>
      {table.error && <div role="alert" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3 text-sm">
        <p>{subjectError(table.error, "Unable to load subjects.")}</p><Button variant="outline" size="sm" onClick={() => void table.refetch()}>Retry</Button>
      </div>}
      <ProTable<SubjectDTO> table={shownTable}
        headerActions={<div className="flex flex-wrap items-center justify-end gap-2">
          {table.permission.canCreate && <ActionButton title="Import" tooltip="Preview and import subjects" variant="secondary" icon={<Upload className="size-4" />} onClick={() => setImportOpen(true)} />}
          {table.permission.canRead && <ActionButton title="Export" tooltip="Export all subjects matching the current filters" variant="secondary" icon={<Download className="size-4" />} onClick={() => setExportOpen(true)} />}
          {table.permission.canCreate && <ActionButton title="Create" tooltip="Create subject" variant="default" icon={<Plus className="size-4" />} onClick={table.openCreate} />}
        </div>}
        onView={(row) => setDetailId(row.id!)} onEdit={openEdit} onDelete={setDeleteSubject}
        renderRowActions={(row) => <div className="flex items-center gap-1">
          {table.permission.canRead && <ActionButton tooltip="View subject" icon={<Eye className="size-4" />} onClick={() => setDetailId(row.id!)} />}
          {table.permission.canUpdate && <ActionButton tooltip="Edit subject" icon={<Pen className="size-4" />} onClick={() => openEdit(row)} />}
          {canClone && <ActionButton tooltip="Clone version" icon={<Copy className="size-4" />} onClick={() => startClone(row)} />}
          {table.permission.canDelete && <ActionButton tooltip="Delete subject" icon={<Trash2 className="size-4 text-destructive" />} onClick={() => setDeleteSubject(row)} />}
        </div>}
        renderFormModal={({open, onClose, initial, onSubmit}) => <SubjectForm open={open} onClose={onClose} initial={initial}
          schema={schema} onSubmit={onSubmit} busy={table.isSubmitting} serverErrors={table.fieldErrors}
          clearError={(name) => table.setFieldErrors((errors) => { const next = {...errors}; delete next[name]; return next; })}
          onClone={canClone ? startClone : undefined} />}
      />
      {detailId !== null && <SubjectDetailSheet id={detailId} onClose={() => setDetailId(null)} onEdit={table.permission.canUpdate ? openEdit : undefined} onClone={canClone ? startClone : undefined} />}
      <SubjectCloneDialog subject={cloneSubject} onClose={() => setCloneSubject(null)} onCreated={(subject) => {
        setCloneSubject(null); refresh(); toast.success(`Version ${subject.version} created as Inactive.`);
        if (table.permission.canUpdate) table.openEdit(subject); else setDetailId(subject.id!);
      }} />
      {deleteSubject && <SubjectDeleteDialog subject={deleteSubject} onClose={() => setDeleteSubject(null)} onDelete={async () => {
        const removed = await table.remove(deleteSubject.id!);
        if (removed && table.data.length === 1 && table.page! > 0) table.setPage(table.page! - 1);
        return removed;
      }} />}
      {importOpen && table.permission.canCreate && <SubjectImportDialog onClose={() => setImportOpen(false)} onImported={refresh} />}
      <ExportModal open={exportOpen} onOpenChange={setExportOpen} table={{schema, exportFile}} canExport={table.permission.canRead}
        title="Export subjects" description="Export all subjects matching your current search and filters, across every page." />
    </MainLayout>
  );
}
