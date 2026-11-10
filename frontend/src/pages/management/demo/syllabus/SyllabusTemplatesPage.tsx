import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { BookCopy, BookOpen, Eye } from "lucide-react";

import {
  syllabusApi,
  type SyllabusSummary,
} from "@/api/features/demo/syllabus.api";
import { syllabusExtrasApi } from "@/api/features/demo/syllabus-extras.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { FormModal } from "@/components/datatable/modal/form/FormModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SyllabusListFooter, SyllabusListToolbar, type SyllabusViewMode } from "./SyllabusListControls";
import { usePermissions } from "@/hooks/usePermissions";
import type { EntitySchema } from "@/types";

const copySchema: EntitySchema = {
  entityName: "syllabus-template-copy",
  idField: "id",
  fields: [
    {
      name: "code",
      label: "New Syllabus Code",
      type: "text",
      hint: "New unique code, e.g. PRN211-2027",
      validation: {
        required: true,
        requiredMessage: "Syllabus Code is required",
        minLength: 3,
        maxLength: 30,
        pattern: {
          regex: /^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$/,
          message: "Use 3-30 characters: letters, numbers, _ or -.",
        },
      },
    },
    {
      name: "name",
      label: "New Syllabus Name",
      type: "text",
      hint: "Choose a different name from the source Syllabus",
      validation: {
        required: true,
        requiredMessage: "Syllabus Name is required",
        minLength: 3,
        maxLength: 150,
        custom: (value) =>
          /\p{L}/u.test(String(value ?? "")) ? null : "Name must contain letters",
      },
    },
  ],
};

function backendError(error: unknown): {
  fields: Record<string, string[]>;
  message: string;
} {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as {
      errors?: Record<string, string[]>;
      message?: string;
      detail?: string;
    } | undefined;
    if (payload?.errors) {
      const fields = payload.errors;
      const message = Object.values(fields).flat().find((v) => typeof v === "string")
        ?? "Please correct the highlighted fields.";
      return { fields, message };
    }
    return {
      fields: {},
      message: payload?.detail || payload?.message || "Could not copy this Syllabus.",
    };
  }
  return { fields: {}, message: "Could not copy this Syllabus." };
}

export default function SyllabusTemplatesPage() {
  const { hasPermission } = usePermissions();
  const canCreate = hasPermission("SYLLABUS_CREATE");
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [sort, setSort] = useState("name");
  const [view, setView] = useState<SyllabusViewMode>("table");
  const [source, setSource] = useState<SyllabusSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const query = useQuery({
    queryKey: ["syllabuses", ""],
    queryFn: () => syllabusApi.list(""),
  });

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (query.data ?? []).filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      return !needle || item.code.toLocaleLowerCase().includes(needle)
        || item.name.toLocaleLowerCase().includes(needle);
    }).sort((a, b) => sort === "code" ? a.code.localeCompare(b.code) : a.name.localeCompare(b.name));
  }, [query.data, search, statusFilter, sort]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const visible = filtered.slice(safePage * pageSize, (safePage + 1) * pageSize);

  function chooseTemplate(item: SyllabusSummary) {
    if (!canCreate) return;
    setFieldErrors({});
    setSource(item);
  }

  async function copy(values: Record<string, unknown>) {
    if (!source || busy || !canCreate) return;
    setBusy(true);
    setFieldErrors({});
    try {
      const result = await syllabusExtrasApi.copyFromTemplate({
        sourceId: source.id,
        code: String(values.code ?? "").trim().toUpperCase(),
        name: String(values.name ?? "").trim().replace(/\s+/g, " "),
      });
      await qc.invalidateQueries({ queryKey: ["syllabuses"] });
      setSource(null);
      toast.success("Draft Syllabus created from template.");
      navigate(`/syllabuses/${result.id}`);
    } catch (error) {
      const result = backendError(error);
      setFieldErrors(result.fields);
      toast.error(result.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <MainLayout pathName={{ syllabuses: "Syllabuses", templates: "Syllabus Templates" }}
      pathLinks={{ syllabuses: "/syllabuses" }}>
      <div className="flex w-full flex-col gap-4 pb-5 font-inter">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Syllabus Templates</h1>
            <p className="text-sm text-muted-foreground">
              Reuse an existing Syllabus to create an independent Draft with CLOs, Sections, Topics and Materials.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/syllabuses"><BookOpen className="size-4" /> Syllabuses</Link>
          </Button>
        </header>

        <SyllabusListToolbar
          search={search} onSearchChange={(value) => { setSearch(value); setPage(0); }}
          searchLabel="Search Syllabus code or name" view={view} onViewChange={setView}
          filters={<>
            <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setPage(0); }}>
              <SelectTrigger aria-label="Filter Syllabus status" className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PUBLISHED">Published</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(value) => { setSort(value); setPage(0); }}>
              <SelectTrigger aria-label="Sort Syllabus templates" className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name (A–Z)</SelectItem>
                <SelectItem value="code">Code (A–Z)</SelectItem>
              </SelectContent>
            </Select>
          </>}
        />

        {query.isPending ? (
          <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">Loading available Syllabuses...</div>
        ) : query.isError ? (
          <div role="alert" className="rounded-md border bg-card p-8 text-center">
            <p className="text-sm text-destructive">Unable to load Syllabuses.</p>
            <Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>Retry</Button>
          </div>
        ) : view === "table" ? (
          <div className="overflow-hidden rounded-md border bg-card">
            <Table className="min-w-[760px] table-fixed">
              <TableHeader className="bg-background">
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead className="w-44">Code</TableHead>
                  <TableHead className="w-[25%]">Syllabus Name</TableHead>
                  <TableHead className="w-28">Status</TableHead>
                  <TableHead className="w-24 text-center">Sections</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-44 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((item, idx) => (
                  <TableRow key={item.id} className="odd:bg-muted/20">
                    <TableCell className="text-center text-muted-foreground">{safePage * pageSize + idx + 1}</TableCell>
                    <TableCell className="truncate font-medium" title={item.code}>{item.code}</TableCell>
                    <TableCell className="truncate" title={item.name}>
                      <Link className="font-medium hover:underline" to={`/syllabuses/${item.id}`}>{item.name}</Link>
                    </TableCell>
                    <TableCell><Badge variant="outline">{item.status === "PUBLISHED" ? "Published" : "Draft"}</Badge></TableCell>
                    <TableCell className="text-center tabular-nums">{item.sectionCount}</TableCell>
                    <TableCell className="truncate text-muted-foreground" title={item.description ?? ""}>
                      {item.description || "No description"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button asChild variant="outline" size="icon-sm" title="View Syllabus">
                          <Link to={`/syllabuses/${item.id}`} aria-label={`View ${item.name}`}><Eye className="size-4" /></Link>
                        </Button>
                        {canCreate && <Button variant="outline" size="sm" onClick={() => chooseTemplate(item)}>
                          <BookCopy className="size-4" /> Use template
                        </Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!visible.length && <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  No Syllabuses match your filters. Create or Import one to use as a template.
                </TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((item, idx) => (
              <article key={item.id} className="flex min-h-56 flex-col gap-3 rounded-md border bg-card p-4">
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>#{safePage * pageSize + idx + 1}</span>
                  <div className="flex items-center gap-1">
                    <Button asChild size="icon-sm" variant="outline" title="View Syllabus">
                      <Link to={`/syllabuses/${item.id}`} aria-label={`View ${item.name}`}><Eye className="size-4" /></Link>
                    </Button>
                    {canCreate && <Button size="icon-sm" variant="outline" title="Use template" aria-label={`Use ${item.name} as template`}
                      onClick={() => chooseTemplate(item)}><BookCopy className="size-4" /></Button>}
                  </div>
                </div>
                <dl className="grid grid-cols-[90px_1fr] gap-x-2 gap-y-2 text-xs">
                  <dt className="text-muted-foreground">Code</dt><dd className="break-all font-medium">{item.code}</dd>
                  <dt className="text-muted-foreground">Syllabus Name</dt><dd className="font-semibold">{item.name}</dd>
                  <dt className="text-muted-foreground">Status</dt><dd><Badge variant="outline">{item.status === "PUBLISHED" ? "Published" : "Draft"}</Badge></dd>
                  <dt className="text-muted-foreground">Sections</dt><dd>{item.sectionCount}</dd>
                  <dt className="text-muted-foreground">Description</dt>
                  <dd className="line-clamp-3 break-words text-muted-foreground">{item.description || "No description"}</dd>
                </dl>
                {canCreate && <Button className="mt-auto w-full" variant="outline" size="sm" onClick={() => chooseTemplate(item)}>
                  <BookCopy className="size-4" /> Use template
                </Button>}
              </article>
            ))}
            {!visible.length && <div className="col-span-full rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
              No Syllabuses match your filters. Create or Import one first.
            </div>}
          </div>
        )}

        {!query.isPending && !query.isError && <SyllabusListFooter count={filtered.length} page={safePage} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(0); }} />}

        <FormModal
          open={Boolean(source)}
          onClose={(open) => { if (!open && !busy) { setSource(null); setFieldErrors({}); } }}
          schema={copySchema}
          title={`Create Draft from ${source?.code ?? "template"}`}
          onSubmit={(values: Record<string, unknown>) => void copy(values)}
          isSubmitting={busy}
          fieldErrors={fieldErrors}
        />
      </div>
    </MainLayout>
  );
}
