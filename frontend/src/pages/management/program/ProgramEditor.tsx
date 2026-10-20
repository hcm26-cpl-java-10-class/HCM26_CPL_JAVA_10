import { useMemo, useState, type FormEvent } from "react";
import { AlertCircle, ArrowDown, ArrowUp, BookOpen, Check, Clock3, LoaderCircle, Search, X } from "lucide-react";
import type { TrainingProgramRequest, TrainingProgramResponse } from "@/api/features/program.api";
import type { SubjectDTO } from "@/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorMessage, normalizeSearch, primaryButtonClass } from "./program-ui";

interface ProgramEditorProps {
  program: TrainingProgramResponse | null;
  subjects: SubjectDTO[];
  loadingSubjects: boolean;
  subjectsError: string;
  onRetrySubjects: () => void;
  onClose: () => void;
  onSave: (request: TrainingProgramRequest) => Promise<void>;
}

export function ProgramEditor({ program, subjects, loadingSubjects, subjectsError, onRetrySubjects, onClose, onSave }: ProgramEditorProps) {
  const [form, setForm] = useState({
    code: program?.code ?? "", name: program?.name ?? "", version: program?.version ?? "1.0",
    region: program?.region ?? "", subjectIds: program?.subjects.map((subject) => subject.subjectId) ?? [],
  });
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const available = subjects.filter((subject): subject is SubjectDTO & { id: number } => subject.id !== undefined);
  const filtered = available.filter((subject) => normalizeSearch(`${subject.code} ${subject.name}`).includes(normalizeSearch(search)));
  const selected = useMemo(() => form.subjectIds.map((id) => {
    const active = subjects.find((subject) => subject.id === id);
    const previous = program?.subjects.find((subject) => subject.subjectId === id);
    return { id, code: active?.code ?? previous?.code ?? `#${id}`, name: active?.name ?? previous?.name ?? "Môn không còn khả dụng",
      hours: active?.durationHours ?? previous?.durationHours ?? 0, available: Boolean(active) };
  }), [form.subjectIds, program, subjects]);
  const totalHours = selected.reduce((total, subject) => total + subject.hours, 0);
  const unavailable = !loadingSubjects && selected.some((subject) => !subject.available);

  const toggleSubject = (id: number, checked: boolean) => {
    setForm((current) => ({ ...current, subjectIds: checked
      ? [...current.subjectIds.filter((subjectId) => subjectId !== id), id]
      : current.subjectIds.filter((subjectId) => subjectId !== id) }));
    setError("");
  };
  const moveSubject = (index: number, offset: number) => {
    setForm((current) => {
      const ids = [...current.subjectIds];
      [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
      return { ...current, subjectIds: ids };
    });
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.version.trim()) {
      setError("Vui lòng điền đầy đủ mã, tên và phiên bản chương trình."); return;
    }
    if (!selected.length) { setError("Chọn ít nhất một môn học để lưu chương trình."); return; }
    setSaving(true); setError("");
    try {
      await onSave({ code: form.code.trim(), name: form.name.trim(), version: form.version.trim(),
        region: form.region.trim() || undefined,
        subjects: form.subjectIds.map((subjectId, index) => ({ subjectId, orderIndex: index + 1 })) });
    } catch (saveError) { setError(errorMessage(saveError, "Không thể lưu chương trình. Vui lòng thử lại.")); }
    finally { setSaving(false); }
  };

  return <Dialog open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
    <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-3xl" showCloseButton={!saving}>
      <DialogHeader className="border-b px-5 py-5 pr-12 sm:px-6">
        <DialogTitle className="text-xl font-semibold">{program ? "Chỉnh sửa chương trình" : "Tạo chương trình mới"}</DialogTitle>
        <DialogDescription>Điền thông tin và chọn môn theo thứ tự giảng dạy. Chương trình sẽ được lưu dưới dạng bản nháp.</DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="flex min-h-0 flex-col overflow-hidden">
        <div className="min-h-0 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          {error && <Alert variant="destructive"><AlertCircle /><AlertDescription>{error}</AlertDescription></Alert>}
          <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold">1. Thông tin chương trình</legend>
            <div className="space-y-2"><Label htmlFor="program-code">Mã chương trình <span className="text-destructive">*</span></Label>
              <Input id="program-code" required maxLength={50} placeholder="VD: JAVA_BACKEND" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="program-name">Tên chương trình <span className="text-destructive">*</span></Label>
              <Input id="program-name" required maxLength={255} placeholder="VD: Lập trình Java Backend" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="program-version">Phiên bản <span className="text-destructive">*</span></Label>
              <Input id="program-version" required maxLength={30} placeholder="VD: 1.0" value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="program-region">Khu vực <span className="font-normal text-muted-foreground">(tùy chọn)</span></Label>
              <Input id="program-region" maxLength={100} placeholder="VD: Hồ Chí Minh" value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} /></div>
          </fieldset>
          <section aria-labelledby="program-subjects-heading" className="space-y-3">
            <div><h3 id="program-subjects-heading" className="font-semibold">2. Môn học & thứ tự giảng dạy <span className="text-destructive">*</span></h3>
              <p className="mt-1 text-xs text-muted-foreground">Tích chọn để thêm môn. Dùng mũi tên để thay đổi thứ tự.</p></div>
            {subjectsError ? <Alert variant="destructive"><AlertCircle /><AlertDescription>{subjectsError}<Button type="button" size="sm" variant="outline" onClick={onRetrySubjects}>Tải lại môn học</Button></AlertDescription></Alert>
              : loadingSubjects ? <p className="flex items-center gap-2 py-6 text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Đang tải môn học…</p>
              : <div className="grid gap-4 sm:grid-cols-2">
                <div className="overflow-hidden rounded-lg border">
                  <div className="relative border-b bg-muted/30 p-3"><Search className="pointer-events-none absolute left-5 top-5 size-4 text-muted-foreground" aria-hidden="true" />
                    <Input aria-label="Tìm môn học" placeholder="Tìm mã hoặc tên môn…" className="bg-background pl-9" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
                  <div className="max-h-60 overflow-y-auto p-1">
                    {filtered.map((subject) => <label key={subject.id} className={`flex cursor-pointer items-start gap-3 rounded-md px-3 py-3 transition-colors hover:bg-muted ${form.subjectIds.includes(subject.id) ? "bg-blue-50/80 dark:bg-blue-950/30" : ""}`}>
                      <Checkbox className="mt-0.5" checked={form.subjectIds.includes(subject.id)} disabled={saving} onCheckedChange={(checked) => toggleSubject(subject.id, checked === true)} aria-label={`Chọn ${subject.code}`} />
                      <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-blue-700 dark:text-blue-300">{subject.code}</span><span className="mt-0.5 block text-sm leading-5">{subject.name}</span></span>
                      <span className="shrink-0 text-xs text-muted-foreground">{subject.durationHours} giờ</span>
                    </label>)}
                    {!filtered.length && <p className="px-3 py-8 text-center text-sm text-muted-foreground">{available.length ? "Không tìm thấy môn phù hợp." : "Chưa có môn đang hoạt động."}</p>}
                  </div>
                </div>
                <div className="flex flex-col rounded-lg border bg-muted/20">
                  <div className="border-b px-3 py-3 text-sm font-medium">Thứ tự giảng dạy <span className="ml-1 text-muted-foreground">({selected.length} môn)</span></div>
                  <ol className="max-h-60 flex-1 space-y-1 overflow-y-auto p-2">
                    {selected.map((subject, index) => <li key={subject.id} className="flex items-center gap-2 rounded-md border bg-background px-2 py-2">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium">{index + 1}</span>
                      <div className="min-w-0 flex-1"><p className="break-words text-xs font-semibold">{subject.code}</p><p className="text-xs text-muted-foreground">{subject.hours} giờ{!subject.available && " · Không còn hoạt động"}</p></div>
                      <div className="flex shrink-0 gap-0.5">
                        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Đưa ${subject.code} lên`} disabled={saving || index === 0} onClick={() => moveSubject(index, -1)}><ArrowUp /></Button>
                        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Đưa ${subject.code} xuống`} disabled={saving || index === selected.length - 1} onClick={() => moveSubject(index, 1)}><ArrowDown /></Button>
                        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Bỏ ${subject.code}`} disabled={saving} onClick={() => toggleSubject(subject.id, false)}><X /></Button>
                      </div>
                    </li>)}
                    {!selected.length && <li className="flex min-h-36 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground"><BookOpen className="size-6 opacity-50" />Chưa chọn môn nào.<br />Chọn môn trong danh sách để bắt đầu.</li>}
                  </ol>
                </div>
              </div>}
            {unavailable && !subjectsError && <p role="alert" className="text-sm text-destructive">Có môn không còn hoạt động. Hãy bỏ hoặc thay thế môn đó trước khi lưu.</p>}
          </section>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/30 px-5 py-4 sm:px-6">
          <p className="flex items-center gap-2 text-sm" aria-live="polite"><Clock3 className="size-4 text-muted-foreground" /><strong>{selected.length} môn</strong><span className="text-muted-foreground">·</span><strong>{totalHours} giờ</strong></p>
          <div className="flex gap-2"><Button type="button" variant="outline" disabled={saving} onClick={onClose}>Hủy</Button>
            <Button className={primaryButtonClass} type="submit" disabled={saving || loadingSubjects || Boolean(subjectsError) || unavailable}>
              {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{saving ? "Đang lưu…" : "Lưu bản nháp"}
            </Button></div>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
