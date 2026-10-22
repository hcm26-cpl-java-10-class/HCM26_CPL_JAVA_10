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

const inputStyle: CSSProperties = {
  display: "block", width: "100%", boxSizing: "border-box", marginTop: 7,
  padding: "11px 12px", border: "1px solid #cbd5e1", borderRadius: 9,
  background: "#ffffff", color: "#0f172a", fontSize: 14, lineHeight: 1.5,
  outlineColor: "#2563eb", boxShadow: "0 1px 2px rgba(15,23,42,.04)",
};
const buttonStyle: CSSProperties = {
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
  padding: "10px 14px", border: "1px solid #cbd5e1", borderRadius: 9,
  background: "#ffffff", color: "#334155", fontSize: 14, fontWeight: 600,
  cursor: "pointer", boxShadow: "0 1px 2px rgba(15,23,42,.05)",
};

export default function TrainingProgramPage() {
  const [programs, setPrograms] = useState<TrainingProgramResponse[]>([]);
  const [subjects, setSubjects] = useState<SubjectDTO[]>([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cloneVersions, setCloneVersions] = useState<Record<number, string>>({});
  const [hoveredProgramId, setHoveredProgramId] = useState<number | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
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
    <main className="training-program-page" style={{ padding: "28px clamp(16px, 2vw, 32px)", maxWidth: 1800, margin: "0 auto", minHeight: "100vh", color: "#f8fafc", background: "#090909", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: 14, lineHeight: 1.6 }}>
      <style>{`
        .training-program-page { color-scheme: dark; }
        .training-program-page h1,.training-program-page h2 { color:#f8fafc !important; }
        .training-program-page p { color:#a1a1aa !important; }
        .training-program-page .program-panel { background:#141414 !important; border:1px solid #303030 !important; box-shadow:0 10px 30px rgba(0,0,0,.24) !important; }
        .training-program-page .program-label { color:#e5e7eb !important; }
        .training-program-page input,.training-program-page select { background:#1b1b1b !important; color:#f9fafb !important; border:1px solid #3f3f46 !important; }
        .training-program-page input::placeholder { color:#a1a1aa !important; }
        .training-program-page select option { background:#1b1b1b; color:#f9fafb; }
        .training-program-page .program-button { transition:transform .18s ease, box-shadow .18s ease, filter .18s ease; }
        .training-program-page .program-button:hover { transform:translateY(-2px) scale(1.035); filter:brightness(1.12); box-shadow:0 0 0 3px rgba(59,130,246,.18),0 0 18px rgba(59,130,246,.16); }
        .training-program-page .program-button:active { transform:scale(.96); animation:programClickPulse .35s ease; }
        .training-program-page .program-table-wrap { border-color:#303030 !important; background:#101010 !important; }
        .training-program-page .program-table { color:#f3f4f6 !important; background:#101010 !important; }
        .training-program-page .program-table thead tr { background:#252525 !important; color:#fff !important; }
        .training-program-page .program-table th { border-bottom:1px solid #3f3f46 !important; }
        .training-program-page .program-row { background:#111111; transition:background .2s ease, box-shadow .2s ease; cursor:pointer; }
        .training-program-page .program-row:nth-child(even) { background:#202020; }
        .training-program-page .program-row:hover { background:#303030 !important; box-shadow:inset 3px 0 #3b82f6,0 0 16px rgba(59,130,246,.08); }
        .training-program-page .program-row.selected { background:#292929 !important; box-shadow:inset 3px 0 #60a5fa; }
        .training-program-page .program-cell { color:#e5e7eb !important; border-bottom:1px solid #303030 !important; transition:font-size .18s ease,color .18s ease; }
        .training-program-page .program-row:hover .program-cell { color:#fff !important; }
        .training-program-page .program-code-cell { position:relative; font-weight:700; }
        .training-program-page .program-row:hover .program-code-cell,.training-program-page .program-row.selected .program-code-cell { font-size:15px !important; }
        .training-program-page .program-title-tooltip { position:absolute; z-index:5; left:12px; bottom:calc(100% - 4px); display:block; width:max-content; max-width:320px; padding:5px 10px; border-radius:6px; background:#fff; color:#171717; box-shadow:0 5px 18px rgba(0,0,0,.45); font-size:12px; font-weight:700; white-space:normal; pointer-events:none; animation:tooltipBlink 1.4s ease-in-out infinite; }
        .training-program-page .program-row:hover .program-title-tooltip,.training-program-page .program-row.selected .program-title-tooltip { display:block; }
        .training-program-page .program-summary { background:#191919 !important; color:#f3f4f6 !important; border:1px solid #303030 !important; }
        .training-program-page .program-details { color:#93c5fd !important; }
        @keyframes tooltipBlink { 0%,100% { opacity:1; transform:translateY(0) scale(1); } 50% { opacity:.78; transform:translateY(-2px) scale(1.025); } }
        @keyframes programClickPulse { 0% { box-shadow:0 0 0 0 rgba(59,130,246,.5); } 100% { box-shadow:0 0 0 8px rgba(59,130,246,0); } }
        @media (prefers-reduced-motion: reduce) { .training-program-page *, .training-program-page *::before, .training-program-page *::after { animation:none !important; transition:none !important; } }
      `}</style>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.03em", color: "#0f172a", margin: 0 }}>Quản lý chương trình đào tạo</h1>
          <p style={{ color: "#64748b", marginTop: 6 }}>Chọn môn đang hoạt động từ API /api/subjects/active và tự tính tổng thời lượng.</p>
        </div>
        <button className="program-button" style={{ ...buttonStyle, background: "#2563eb", color: "#ffffff", borderColor: "#2563eb", padding: "11px 17px" }} onClick={() => void exportCsv()}>Export CSV</button>
      </header>

      {error && <div role="alert" style={{ background: "#fee2e2", color: "#991b1b", padding: 12, borderRadius: 8, marginTop: 16 }}>{error}</div>}
      {message && <div role="status" style={{ background: "#dcfce7", color: "#166534", padding: 12, borderRadius: 8, marginTop: 16 }}>{message}</div>}

      <section className="program-panel" style={{ marginTop: 24, padding: 24, background: "#141414", border: "1px solid #303030", borderRadius: 16, boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
        <h2 style={{ fontSize: 20, fontWeight: 750, color: "#0f172a", marginTop: 0, marginBottom: 20 }}>{editingId === null ? "Tạo chương trình" : `Sửa chương trình #${editingId}`}</h2>
        <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <label className="program-label" style={{ display: "block", color: "#e5e7eb", fontWeight: 650 }}>Mã chương trình<input required maxLength={50} style={inputStyle} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label>
          <label className="program-label" style={{ display: "block", color: "#e5e7eb", fontWeight: 650 }}>Tên chương trình<input required maxLength={255} style={inputStyle} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="program-label" style={{ display: "block", color: "#e5e7eb", fontWeight: 650 }}>Phiên bản<input required maxLength={30} style={inputStyle} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></label>
          <label className="program-label" style={{ display: "block", color: "#e5e7eb", fontWeight: 650 }}>Khu vực<input maxLength={100} style={inputStyle} value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></label>
          <label className="program-label" style={{ gridColumn: "1 / -1", display: "block", color: "#e5e7eb", fontWeight: 650 }}>Môn học <span style={{ fontWeight: 400, color: "#64748b" }}>(giữ Ctrl để chọn nhiều)</span>
            <select multiple required value={form.subjectIds.map(String)} onChange={(e) => setForm({ ...form, subjectIds: Array.from(e.target.selectedOptions).map((o) => Number(o.value)) })} style={{ ...inputStyle, minHeight: 140 }}>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.code} — {subject.name} ({subject.durationHours} giờ)</option>)}
            </select>
          </label>
          <div className="program-summary" style={{ gridColumn: "1 / -1", background: "#191919", color: "#f3f4f6", padding: 16, border: "1px solid #303030", borderRadius: 12 }}>
            <strong>Số môn: {selectedSubjects.length}</strong> · <strong>Tổng thời lượng: {totalHours} giờ</strong>
            <ol>{selectedSubjects.map((subject, i) => <li key={subject.id}>{i + 1}. {subject.name} — {subject.durationHours} giờ</li>)}</ol>
          </div>
          <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8 }}>
            <button type="submit" disabled={busy} style={{ ...buttonStyle, background: busy ? "#93c5fd" : "#2563eb", color: "white", borderColor: "#2563eb", opacity: busy ? .75 : 1 }}>{busy ? "Đang lưu..." : "Lưu chương trình"}</button>
            <button type="button" style={buttonStyle} onClick={resetForm}>Làm mới</button>
          </div>
        </form>
      </section>

      <section className="program-panel" style={{ marginTop: 28, padding: 22, background: "#141414", border: "1px solid #303030", borderRadius: 16, boxShadow: "0 8px 24px rgba(0,0,0,.24)" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input placeholder="Tìm theo mã hoặc tên chương trình..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inputStyle, maxWidth: 440 }} />
          <button className="program-button" style={buttonStyle} onClick={() => void load()}>Tìm kiếm</button>
          <button className="program-button" style={buttonStyle} onClick={() => { setSearch(""); }}>Xóa lọc</button>
        </div>
        <div className="program-table-wrap" style={{ overflowX: "auto", border: "1px solid #303030", borderRadius: 12, background: "#101010" }}>
          <table className="program-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: 950, color: "#f3f4f6", background: "#101010" }}>
            <thead><tr style={{ background: "#eaf0f8", color: "#0f172a", textAlign: "left" }}>
              {["Mã", "Tên", "Phiên bản", "Khu vực", "Môn học", "Tổng giờ", "Trạng thái", "Thao tác"].map((h) => <th key={h} style={{ padding: "14px 12px", borderBottom: "1px solid #dbe3ee", fontSize: 12, textTransform: "uppercase", letterSpacing: ".04em", whiteSpace: "nowrap" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {programs.map((p) => <tr key={p.id} className={`program-row${selectedProgramId === p.id ? " selected" : ""}`} onMouseEnter={() => setHoveredProgramId(p.id)} onMouseLeave={() => setHoveredProgramId(null)} onClick={() => setSelectedProgramId((current) => current === p.id ? null : p.id)} aria-selected={selectedProgramId === p.id}>
                <td className="program-cell program-code-cell" style={{ padding: 14, borderBottom: "1px solid #303030", color: "#e5e7eb", verticalAlign: "top" }}>{p.code}{(hoveredProgramId === p.id || selectedProgramId === p.id) && <span className="program-title-tooltip">{p.code}</span>}</td>
                <td className="program-cell" style={{ padding: 14, borderBottom: "1px solid #303030", color: "#e5e7eb", verticalAlign: "top" }}>{p.name}</td>
                <td className="program-cell" style={{ padding: 14, borderBottom: "1px solid #303030", color: "#e5e7eb", verticalAlign: "top" }}>{p.version}</td>
                <td className="program-cell" style={{ padding: 14, borderBottom: "1px solid #303030", color: "#e5e7eb", verticalAlign: "top" }}>{p.region || "—"}</td>
                <td className="program-cell" style={{ padding: 14, borderBottom: "1px solid #303030", color: "#e5e7eb", verticalAlign: "top" }}>{p.subjects.length}</td>
                <td className="program-cell" style={{ padding: 14, borderBottom: "1px solid #303030", color: "#e5e7eb", verticalAlign: "top" }}>{p.totalDurationHours} h</td>
                <td className="program-cell" style={{ padding: 14, borderBottom: "1px solid #303030", color: "#e5e7eb", verticalAlign: "top" }}>{p.status}</td>
                <td style={{ padding: 14, borderBottom: "1px solid #edf2f7", minWidth: 300, verticalAlign: "top" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <button className="program-button" style={{ ...buttonStyle, padding: "7px 10px" }} onClick={() => edit(p)}>Sửa</button>
                    {p.status !== "ACTIVE" && <button className="program-button" style={{ ...buttonStyle, padding: "7px 10px", color: "#166534", background: "#f0fdf4", borderColor: "#bbf7d0" }} onClick={() => void activate(p.id)}>Kích hoạt</button>}
                    <input aria-label={`Phiên bản clone ${p.code}`} placeholder="Phiên bản mới" value={cloneVersions[p.id] || ""} onChange={(e) => setCloneVersions((old) => ({ ...old, [p.id]: e.target.value }))} style={{ ...inputStyle, width: 125, marginTop: 0, padding: "7px 9px" }} />
                    <button className="program-button" style={{ ...buttonStyle, padding: "7px 10px", color: "#1d4ed8", background: "#eff6ff", borderColor: "#bfdbfe" }} onClick={() => void clone(p)}>Clone</button>
                  </div>
                  <details style={{ marginTop: 8 }}>
                    <summary className="program-details" style={{ cursor: "pointer", color: "#93c5fd", fontWeight: 600, marginTop: 4 }}>Xem danh sách môn</summary>
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
