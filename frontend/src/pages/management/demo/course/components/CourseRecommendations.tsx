import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { recommendationsApi, type Recommendation, type Turn } from "@/api/features/recommendations.api";
import { courseReplyText, recommendationPage, RecommendationRequest, readRecommendationHistory, recommendationHistoryKey } from "@/utils/recommendation-session";
import { useCourseEnrollment } from "../hooks/useCourseEnrollment";
import { CourseCard, CourseCardSkeleton } from "./CourseCard";

export function CourseRecommendations({ search = "" }: { search?: string }) {
  const { user } = useAuth();
  const { activeRole, hasPermission } = usePermissions();
  if (!user?.email || activeRole !== "STUDENT" || !hasPermission("ENROLLMENT_CREATE")) return null;
  return <AccountRecommendations key={user.email} account={user.email} search={search} />;
}

function AccountRecommendations({ account, search }: { account: string; search: string }) {
  const client = useQueryClient();
  const queryKey = ["course-recommendations", account];
  const query = useQuery({ queryKey, queryFn: ({ signal }) => recommendationsApi.get(signal), staleTime: 0, gcTime: 0, retry: 1 });
  const { canEnroll, enrollMutation, enrollmentByCourseId } = useCourseEnrollment();
  const request = useRef(new RecommendationRequest());
  const action = useRef(new RecommendationRequest());
  const locked = useRef(false);
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [goals, setGoals] = useState("");
  const [interests, setInterests] = useState("");
  const [language, setLanguage] = useState<"en" | "vi">("en");
  const [input, setInput] = useState("");
  const [cards, setCards] = useState<Recommendation[] | null>(null);
  const [chatState, setChatState] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [messages, setMessages] = useState<Turn[]>(() => {
    try { return readRecommendationHistory(sessionStorage.getItem(recommendationHistoryKey(account))); } catch { return []; }
  });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => { request.current.cancel(); action.current.cancel(); }, []);
  useEffect(() => {
    try { sessionStorage.setItem(recommendationHistoryKey(account), JSON.stringify(messages.slice(-8))); } catch { /* Storage can be unavailable. */ }
  }, [account, messages]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  const vi = language === "vi";
  const text = (en: string, vn: string) => vi ? vn : en;
  const cancelChat = () => { request.current.cancel(); locked.current = false; setPending(false); };
  const clear = () => { setPage(1); cancelChat(); setMessages([]); setInput(""); setCards(null); setChatState(""); setAiStatus(""); setError(""); };
  const refresh = async () => { cancelChat(); setPage(1); setCards(null); setChatState(""); await client.invalidateQueries({ queryKey }); };
  const update = async (kind: "save" | "reset" | "dismiss", id?: number) => {
    if (saving) return;
    const topics = interests.split(",").map(t => t.trim()).filter(Boolean);
    if (kind === "save" && (topics.length > 20 || topics.some(t => t.length > 80))) {
      setError(text("Use at most 20 topics, each up to 80 characters.", "Nhập tối đa 20 chủ đề, mỗi chủ đề tối đa 80 ký tự.")); return;
    }
    cancelChat();
    const ticket = action.current.next();
    setSaving(true); setError("");
    try {
      if (kind === "save") await recommendationsApi.save({ goals, interests: topics }, ticket.signal);
      else if (kind === "reset") await recommendationsApi.reset(ticket.signal);
      else await recommendationsApi.dismiss(id!, ticket.signal);
      if (!ticket.current()) return;
      if (kind !== "dismiss") setEditing(false);
      await refresh();
    } catch { if (ticket.current()) setError(text("Could not save this change. Try again.", "Không lưu được thay đổi. Vui lòng thử lại.")); }
    finally { if (ticket.current()) setSaving(false); }
  };
  const send = async () => {
    const message = input.trim();
    if (!message || message.length > 1000 || locked.current || saving) return;
    locked.current = true;
    const ticket = request.current.next();
    const history = messages.slice(-8);
    setMessages([...history, { role: "user" as const, content: message }].slice(-8));
    setInput(""); setPending(true); setError("");
    try {
      // History excludes the current message; the backend appends it exactly once.
      const result = await recommendationsApi.ask(message, history, language, ticket.signal);
      if (!ticket.current()) return;
      const listed = result.recommendations.map(i => i.course.name).join(", ");
      const content = `${courseReplyText(result.reply)}${listed ? "\n" + listed : ""}`.slice(0, 2000);
      setMessages(prev => [...prev, { role: "assistant" as const, content }].slice(-8));
      setPage(1); setCards(result.recommendations); setChatState(result.state); setAiStatus(result.aiStatus);
    } catch {
      if (ticket.current()) { setError(text("Could not reach AI. Retry your question; automatic recommendations remain available.", "Không kết nối được AI. Hãy thử lại; các gợi ý tự động vẫn dùng được.")); setInput(message); }
    } finally { if (ticket.current()) { setPending(false); locked.current = false; } }
  };
  const enroll = (id: number) => {
    cancelChat();
    enrollMutation.mutate(id, { onSuccess: () => { void refresh(); } });
  };
  const keyword = search.trim().toLowerCase();
  const visible = (cards ?? query.data?.recommendations ?? []).filter(i =>
    !enrollmentByCourseId.has(i.course.id) && (!keyword ||
      [i.course.name, i.course.description, i.course.instructor].some(value => value?.toLowerCase().includes(keyword))));
  useEffect(() => { setPage(1); }, [search]);
  const paged = recommendationPage(visible, page);
  useEffect(() => { setPage(paged.page); }, [paged.page]);
  const state = cards ? chatState : query.data?.state;
  return <section aria-labelledby="recommendations-title" className="space-y-3 rounded-2xl border bg-slate-50/60 p-4 dark:bg-slate-900/30">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="recommendations-title" className="text-xl font-semibold">{text("Recommended for you", "Gợi ý dành cho bạn")}</h2>
        <p className="text-sm text-muted-foreground">{text("Based on your own interests and learning activity. Content duration is not guaranteed study time. Check course details for prerequisites.", "Dựa trên sở thích và hoạt động học của chính bạn. Thời lượng nội dung không phải thời gian học đảm bảo. Xem chi tiết để kiểm tra yêu cầu đầu vào.")}</p></div>
      <label className="text-sm">{text("Language", "Ngôn ngữ")} <select aria-label="Recommendation language" className="rounded border bg-background p-1" value={language} onChange={e => setLanguage(e.target.value as "en" | "vi")}><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" aria-expanded={open} onClick={() => setOpen(!open)}>{text("Ask AI to help me choose", "Nhờ AI giúp chọn khóa học")}</Button>
      <Button variant="outline" disabled={!query.data || saving} aria-expanded={editing} onClick={() => { setGoals(query.data?.preferences.goals ?? ""); setInterests(query.data?.preferences.interests.join(", ") ?? ""); setEditing(!editing); }}>{text("Learning preferences", "Sở thích học tập")}</Button>
      <Button variant="ghost" disabled={saving || query.isFetching} onClick={() => void refresh()}>{text("Refresh", "Làm mới")}</Button>
    </div>
    {editing && <form className="space-y-3 rounded-xl border bg-background p-3" onSubmit={e => { e.preventDefault(); void update("save"); }}>
      <p className="text-sm text-muted-foreground">{text("Saved goals and topics filter your recommendations. Only matching courses will appear; reset preferences to explore all eligible topics.", "Mục tiêu và chủ đề đã lưu lọc các khóa học được gợi ý. Chỉ khóa học phù hợp sẽ xuất hiện; đặt lại sở thích để khám phá mọi chủ đề đủ điều kiện.")}</p>
      <label className="block text-sm">{text("Learning goals", "Mục tiêu học tập")}<textarea className="mt-1 block min-h-20 w-full rounded border bg-background p-2" maxLength={1000} value={goals} onChange={e => setGoals(e.target.value)} /></label>
      <label className="block text-sm">{text("Topic interests (separate with commas)", "Chủ đề quan tâm (phân cách bằng dấu phẩy)")}<Input maxLength={1600} value={interests} onChange={e => setInterests(e.target.value)} /></label>
      <p className="text-xs text-muted-foreground">{text("Reset removes saved goals, interests and dismissals. Conversation is kept. Clear chat only removes the conversation.", "Đặt lại sẽ xóa mục tiêu, sở thích và các khóa đã ẩn; giữ cuộc trò chuyện. Xóa trò chuyện chỉ xóa nội dung trò chuyện.")}</p>
      <div className="flex flex-wrap gap-2"><Button disabled={saving} type="submit">{text("Save preferences", "Lưu sở thích")}</Button><Button disabled={saving} type="button" variant="outline" onClick={() => void update("reset")}>{text("Reset preferences and dismissals", "Đặt lại sở thích và khóa đã ẩn")}</Button></div>
    </form>}
    {open && <div className="space-y-4 rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-background to-sky-50 p-4 shadow-sm sm:p-5 dark:border-indigo-800 dark:from-indigo-950/60 dark:to-slate-900">
      <div className="flex items-center justify-between gap-2"><h3 className="flex items-center gap-2 text-lg font-semibold text-indigo-900 dark:text-indigo-100"><Sparkles aria-hidden="true" className="size-5" />{text("Your AI course guide", "AI đồng hành chọn khóa học")}</h3><Button variant="ghost" onClick={clear}>{text("Clear chat", "Xóa trò chuyện")}</Button></div>
      <p className="text-sm text-muted-foreground">{text("Tell me your goals, what you already know, preferred difficulty and content length. Try “something easier”, “shorter courses”, or “why this course?”", "Cho biết mục tiêu, kiến thức đã có, độ khó và thời lượng mong muốn. Thử “dễ hơn”, “ngắn hơn”, hoặc “tại sao chọn khóa này?”")}</p>
      <div className="flex flex-wrap gap-2" aria-label={text("Suggested questions", "Câu hỏi gợi ý")}>
        {[text("Help me choose a beginner course", "Giúp tôi chọn khóa học cơ bản"), text("Show me shorter courses", "Gợi ý khóa học ngắn hơn"), text("Why this course?", "Tại sao chọn khóa này?")].map(prompt => <Button key={prompt} type="button" variant="outline" size="sm" className="h-auto whitespace-normal rounded-full text-left" disabled={pending || saving} onClick={() => { setInput(prompt); inputRef.current?.focus(); }}>{prompt}</Button>)}
      </div>
      <div role="log" aria-live="polite" aria-busy={pending} className="max-h-72 space-y-2 overflow-y-auto">
        {messages.map((m,i) => <p key={i} className={`whitespace-pre-wrap break-words rounded-lg p-3 text-sm ${m.role === "user" ? "ml-6 border border-indigo-200 bg-indigo-100 text-indigo-950 dark:border-indigo-700 dark:bg-indigo-900 dark:text-indigo-50" : "mr-6 border bg-background shadow-sm"}`}><strong>{m.role === "user" ? text("You", "Bạn") : "AI"}: </strong>{m.role === "assistant" ? courseReplyText(m.content) : m.content}</p>)}
        {pending && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 aria-hidden="true" className="size-4 animate-spin" />{text("Choosing courses…", "Đang chọn khóa học…")}</p>}
      </div>
      <form className="flex flex-col items-end gap-2 sm:flex-row" onSubmit={e => { e.preventDefault(); void send(); }}><textarea rows={2} className="min-h-20 w-full resize-y rounded-xl border bg-background p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" ref={inputRef} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} aria-label={text("Your course question", "Câu hỏi về khóa học")} placeholder={text("What would you like to learn?", "Bạn muốn học gì?")} maxLength={1000} value={input} onChange={e => setInput(e.target.value)} /><Button disabled={pending || saving || !input.trim()} type="submit"><Send aria-hidden="true" className="mr-2 size-4" />{pending ? text("Choosing…", "Đang chọn…") : text("Send", "Gửi")}</Button></form>
      <p className="text-xs text-muted-foreground">{text("Enter to send · Shift+Enter for a new line. AI suggestions may be imperfect; check course details.", "Enter để gửi · Shift+Enter để xuống dòng. Gợi ý AI có thể chưa chính xác; hãy xem chi tiết khóa học.")}</p>
      {aiStatus && aiStatus !== "AVAILABLE" && aiStatus !== "NOT_NEEDED" && <p role="status" className="text-sm">{text("AI unavailable or request limit reached. Showing catalog-based suggestions.", "AI không khả dụng hoặc đã đạt giới hạn. Đang hiển thị gợi ý từ danh mục.")}</p>}
    </div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {query.isError && <div role="alert"><p>{text("Could not load recommendations.", "Không tải được gợi ý.")}</p><Button variant="outline" onClick={() => void query.refetch()}>{text("Retry", "Thử lại")}</Button></div>}
    {query.isLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3].map(i => <CourseCardSkeleton key={i} />)}</div> : visible.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {paged.items.map(item => <div key={item.course.id} className="space-y-2">
        <CourseCard course={item.course} canEnroll={canEnroll} isEnrolling={enrollMutation.isPending && enrollMutation.variables === item.course.id} canAssign={false} showDetailAction onEnroll={enroll} />
        <p className="text-sm">{vi ? translateReason(item.reason) : item.reason}</p>
        <Button variant="ghost" size="sm" disabled={saving} aria-label={`${text("Dismiss", "Ẩn")} ${item.course.name}`} onClick={() => void update("dismiss", item.course.id)}>{text("Not suitable · Dismiss", "Không phù hợp · Ẩn")}</Button>
      </div>)}
    </div> : !query.isError && <p role="status" className="rounded-xl border border-dashed p-4">{keyword ? text("No recommended courses match your search. Clear or change the search to see more suggestions.", "Không có khóa học được gợi ý phù hợp với tìm kiếm. Xóa hoặc đổi từ khóa để xem thêm gợi ý.") : state === "EMPTY_CATALOG" ? text("No active published courses yet.", "Chưa có khóa học đang hoạt động và công khai.") : state === "NO_MATCHES" ? text("No matching courses. Try different preferences or another question.", "Không có khóa phù hợp. Hãy thử sở thích hoặc câu hỏi khác.") : text("No more eligible courses. You may already be enrolled or have dismissed the available courses. Reset dismissals to reconsider them.", "Không còn khóa học đủ điều kiện. Bạn có thể đã đăng ký hoặc ẩn các khóa hiện có. Đặt lại để xem lại các khóa đã ẩn.")}</p>}
    {visible.length > 6 && <nav aria-label={text("Recommendation pages", "Trang gợi ý")} className="flex items-center justify-center gap-3">
      <Button variant="outline" disabled={paged.page === 1} onClick={() => setPage(paged.page - 1)}>{text("Previous", "Trước")}</Button>
      <span role="status" className="text-sm">{text("Page", "Trang")} {paged.page} / {paged.total}</span>
      <Button variant="outline" disabled={paged.page === paged.total} onClick={() => setPage(paged.page + 1)}>{text("Next", "Sau")}</Button>
    </nav>}
  </section>;
}
function translateReason(reason: string) {
  if (reason.startsWith("Matches")) return "Phù hợp với mục tiêu hoặc chủ đề bạn đã lưu.";
  if (reason.startsWith("Related")) return "Liên quan đến chủ đề trong hoạt động học của bạn.";
  if (reason.startsWith("An introductory")) return "Một lựa chọn nhập môn để khám phá.";
  return "Một lựa chọn hiện có trong danh mục để khám phá.";
}
