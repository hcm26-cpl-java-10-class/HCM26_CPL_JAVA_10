import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type CSSProperties,
} from "react";
import {
  programApi,
  type TrainingProgramRequest,
  type TrainingProgramResponse,
} from "@/api/features/program.api";
import { subjectApi } from "@/api/features/subject.api";
import type { SubjectDTO } from "@/types";
import type { EntityConfig, EntitySchema } from "@/types";

const schema: EntitySchema = {
  entityName: "training-program",
  idField: "id",
  fields: [
    { name: "code", label: "Code", type: "text", sortable: true, filterable: true, filterType: "text" },
    { name: "name", label: "Name", type: "text", sortable: true, filterable: true, filterType: "text" },
    { name: "version", label: "Version", type: "text", sortable: true, filterable: true, filterType: "text" },
    { name: "region", label: "Region", type: "text", sortable: true, filterable: true, filterType: "text" },
    { name: "status", label: "Status", type: "text", sortable: true },
  ],
};

export const entityConfig = {
  name: "Training Programs",
  path: "/programs",
  api: {} as any,
  schema,
} as EntityConfig;

const inputStyle: CSSProperties = { /* giữ nguyên các thuộc tính hiện tại */ };
const buttonStyle: CSSProperties = { /* giữ nguyên các thuộc tính hiện tại */ };

export default function TrainingProgramPage() {
  const [programs, setPrograms] = useState<TrainingProgramResponse[]>([]);
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cloneVersions, setCloneVersions] = useState<Record<number, string>>({});
  const [form, setForm] = useState({
    code: "", name: "", version: "1.0", region: "",
    subjectIds: [] as number[],
  });

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [programData, activeSubjects] = await Promise.all([
        programApi.getAll(search.trim() ? { search: search.trim() } : undefined),
        subjectApi.getActiveSubjects(),
      ]);
      setPrograms(programData);
      setSubjects(activeSubjects);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được chương trình hoặc danh sách môn học. Hãy kiểm tra backend và quyền đăng nhập.");
    } finally {
      setBusy(false);
    }
  }, [search]);

  useEffect(() => { void load(); }, [load]);

  const selectedSubjects = useMemo(
    () => form.subjectIds.map((id) => subjects.find((s) => s.id === id)).filter(Boolean) as SubjectDTO[],
    [form.subjectIds, subjects],
  );
  const totalHours = selectedSubjects.reduce((sum, subject) => sum + (subject.durationHours || 0), 0);

  const resetForm = () => {
    setEditingId(null);
    setForm({ code: "", name: "", version: "1.0", region: "", subjectIds: [] });
    setMessage("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(""); setMessage("");
    if (form.subjectIds.length === 0) {
      setError("Hãy chọn ít nhất một môn học cho chương trình.");
      return;
    }
    const payload: TrainingProgramRequest = {
      code: form.code.trim(), name: form.name.trim(), version: form.version.trim(),
      region: form.region.trim() || undefined,
      subjects: form.subjectIds.map((subjectId, index) => ({ subjectId, orderIndex: index + 1 })),
    };
    setBusy(true);
    try {
      if (editingId === null) await programApi.create(payload);
      else await programApi.update(editingId, payload);
      setMessage(editingId === null ? "Tạo chương trình thành công." : "Cập nhật chương trình thành công.");
      resetForm();
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không thể lưu chương trình. Hãy kiểm tra dữ liệu và trạng thái môn học.");
    } finally { setBusy(false); }
  };

  const edit = (program: TrainingProgramResponse) => {
    if (program.status === "ACTIVE") {
      setError("Chương trình ACTIVE không được sửa trực tiếp. Hãy clone phiên bản mới.");
      return;
    }
    setEditingId(program.id);
    setForm({
      code: program.code, name: program.name, version: program.version,
      region: program.region || "", subjectIds: program.subjects.map((s) => s.subjectId),
    });
    setError(""); setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const activate = async (id: number) => {
    setError(""); setMessage("");
    try {
      await programApi.activate(id);
      setMessage("Đã kích hoạt chương trình.");
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không thể kích hoạt chương trình.");
    }
  };

  const clone = async (program: TrainingProgramResponse) => {
    const newVersion = (cloneVersions[program.id] || "").trim();
    if (!newVersion) { setError(`Nhập phiên bản mới cho ${program.code} trước khi clone.`); return; }
    try {
      setError(""); setMessage("");
      await programApi.cloneVersion(program.id, newVersion);
      setMessage(`Đã clone ${program.code} thành phiên bản ${newVersion}.`);
      setCloneVersions((old) => ({ ...old, [program.id]: "" }));
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Clone phiên bản thất bại.");
    }
  };

  const exportCsv = async () => {
    try {
      const blob = await programApi.exportCsv(search || undefined);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "training-programs.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) { setError(e?.response?.data?.message || "Export thất bại."); }
  };

  return (
    <main style={{ padding: 24, maxWidth: 1400, margin: "0 auto", color: "#111827" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Quản lý chương trình đào tạo</h1>
          <p style={{ color: "#64748b", marginTop: 6 }}>Chọn môn đang hoạt động từ API /api/subjects/active và tự tính tổng thời lượng.</p>
        </div>
        <button style={buttonStyle} onClick={() => void exportCsv()}>Export CSV</button>
      </header>

      {error && <div role="alert" style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8, marginTop: 16 }}>{error}</div>}
      {message && <div role="status" style={{ background: "#dcfce7", color: "#166534", padding: 12, borderRadius: 8, marginTop: 16 }}>{message}</div>}

      <section style={{ marginTop: 20, padding: 20, border: "1px solid #e2e8f0", borderRadius: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 650, marginTop: 0 }}>{editingId === null ? "Tạo chương trình" : `Sửa chương trình #${editingId}`}</h2>
        <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <label>Mã chương trình<input required maxLength={50} style={inputStyle} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label>Tên chương trình<input required maxLength={255} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Phiên bản<input required maxLength={30} style={inputStyle} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></label>
          <label>Khu vực<input maxLength={100} style={inputStyle} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></label>
          <label style={{ gridColumn: "1 / -1" }}>Môn học (giữ Ctrl để chọn nhiều)
            <select multiple required value={form.subjectIds.map(String)} onChange={(e) => setForm({ ...form, subjectIds: Array.from(e.target.selectedOptions).map((o) => Number(o.value)) })} style={{ ...inputStyle, minHeight: 140 }}>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} — {subject.name} ({subject.durationHours} giờ)</option>)}
            </select>
          </label>
          <div style={{ gridColumn: "1 / -1", background: "#f8fafc", padding: 12, borderRadius: 8 }}>
            <strong>Số môn: {selectedSubjects.length}</strong> · <strong>Tổng thời lượng: {totalHours} giờ</strong>
            <ol>{selectedSubjects.map((subject, i) => <li key={subject.id}>{i + 1}. {subject.name} — {subject.durationHours} giờ</li>)}</ol>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
            <button type="submit" disabled={busy} style={{ ...buttonStyle, background: "#1d4ed8", color: "white" }}>{busy ? "Đang lưu..." : "Lưu chương trình"}</button>
            <button type="button" style={buttonStyle} onClick={resetForm}>Làm mới</button>
          </div>
        </form>
      </section>

      <section style={{ marginTop: 24 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input placeholder="Tìm theo mã hoặc tên chương trình..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: 440 }} />
          <button style={buttonStyle} onClick={() => void load()}>Tìm kiếm</button>
          <button style={buttonStyle} onClick={() => { setSearch(""); }}>Xóa lọc</button>
        </div>
        <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 950 }}>
            <thead><tr style={{ background: "#f1f5f9", textAlign: "left" }}>
              {["Mã", "Tên", "Phiên bản", "Khu vực", "Môn học", "Tổng giờ", "Trạng thái", "Thao tác"].map((h) => <th key={h} style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {programs.map((p) => <tr key={p.id}>
                <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>{p.code}</td>
                <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>{p.name}</td>
                <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>{p.version}</td>
                <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>{p.region || "—"}</td>
                <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>{p.subjects.length}</td>
                <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>{p.totalDurationHours} h</td>
                <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0" }}>{p.status}</td>
                <td style={{ padding: 12, borderBottom: "1px solid #e2e8f0", minWidth: 260 }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <button style={buttonStyle} onClick={() => edit(p)}>Sửa</button>
                    {p.status !== "ACTIVE" && <button style={buttonStyle} onClick={() => void activate(p.id)}>Kích hoạt</button>}
                    <input aria-label={`Phiên bản clone ${p.code}`} placeholder="Phiên bản mới" value={cloneVersions[p.id] || ""} onChange={(e) => setCloneVersions((old) => ({ ...old, [p.id]: e.target.value }))} style={{ ...inputStyle, width: 110 }} />
                    <button style={buttonStyle} onClick={() => void clone(p)}>Clone</button>
                  </div>
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer" }}>Xem danh sách môn</summary>
                    <ol>{p.subjects.map((s) => <li key={s.subjectId}>{s.orderIndex}. {s.code} — {s.name} ({s.durationHours} giờ)</li>)}</ol>
                  </details>
                </td>
              </tr>)}
              {!programs.length && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "#64748b" }}>{busy ? "Đang tải..." : "Chưa có chương trình đào tạo."}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
