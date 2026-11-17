import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Loader2, Square, RotateCcw, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { recommendationsApi, type Recommendation } from "@/api/features/recommendations.api";
import { recommendationContext, type RecommendationTurn, courseReplyText, recommendationPage, RecommendationRequest, readRecommendationHistory, recommendationHistoryKey } from "@/utils/recommendation-session";
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
  const [retryTurn, setRetryTurn] = useState<{message: string; history: RecommendationTurn[]} | null>(null);
  const pendingTurn = useRef<{message: string; history: RecommendationTurn[]} | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const followLatest = useRef(true);
  const [showLatest, setShowLatest] = useState(false);
  const [messages, setMessages] = useState<RecommendationTurn[]>(() => {
    try { return readRecommendationHistory(sessionStorage.getItem(recommendationHistoryKey(account))); } catch { return []; }
  });
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => () => { request.current.cancel(); action.current.cancel(); }, []);
  useEffect(() => {
    try { sessionStorage.setItem(recommendationHistoryKey(account), JSON.stringify(messages.slice(-8))); } catch { /* Storage can be unavailable. */ }
  }, [account, messages]);
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => {
    const log = logRef.current;
    if (log && followLatest.current) log.scrollTop = log.scrollHeight;
    if (log && !followLatest.current) setShowLatest(true);
  }, [messages, pending, open]);
  useEffect(() => {
    const textarea = inputRef.current;
    if (textarea) { textarea.style.height = "auto"; textarea.style.height = `${Math.min(textarea.scrollHeight || 48, 144)}px`; }
  }, [input, open]);
  const vi = language === "vi";
  const text = (en: string, vn: string) => vi ? vn : en;
  const cancelChat = () => {
    const turn = pendingTurn.current;
    request.current.cancel(); pendingTurn.current = null; locked.current = false; setPending(false); setRetryTurn(null);
    if (turn) { setMessages(turn.history); setInput(current => current || turn.message); }
  };
  const clear = () => { setPage(1); cancelChat(); setRetryTurn(null); pendingTurn.current = null; setShowLatest(false); followLatest.current = true; setMessages([]); setInput(""); setCards(null); setChatState(""); setAiStatus(""); setError(""); };
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
  const send = async (retry = false) => {
    const message = retry && retryTurn ? retryTurn.message : input.trim();
    if (!message || message.length > 1000 || locked.current || saving) return;
    locked.current = true;
    const ticket = request.current.next();
    const history = retry && retryTurn ? retryTurn.history : messages.slice(-8);
    pendingTurn.current = { message, history }; setRetryTurn(null);
    followLatest.current = true; setShowLatest(false);
    setMessages([...history, { role: "user" as const, content: message }].slice(-8));
    setInput(""); setPending(true); setError("");
    try {
      // History excludes the current message; the backend appends it exactly once.
      const result = await recommendationsApi.ask(message, recommendationContext(history), language, ticket.signal);
      if (!ticket.current()) return;
      const content = courseReplyText(result.reply).slice(0, 2000);
      setMessages(prev => [...prev, { role: "assistant" as const, content, courseNames: result.recommendations.map(i => i.course.name) }].slice(-8));
      setPage(1); setCards(result.recommendations); setChatState(result.state); setAiStatus(result.aiStatus);
    } catch {
      if (ticket.current()) { setError(text("Could not reach AI. Retry your question; automatic recommendations remain available.", "Không kết nối được AI. Hãy thử lại; các gợi ý tự động vẫn dùng được.")); setMessages(history); setInput(current => current || message); setRetryTurn({message,history}); }
    } finally { if (ticket.current()) { setPending(false); locked.current = false; pendingTurn.current = null; inputRef.current?.focus(); } }
  };
  const stop = () => { cancelChat(); setError(""); inputRef.current?.focus(); };
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
      <label className="text-sm">{text("Language", "Ngôn ngữ")} <select aria-label="Recommendation language" className="rounded border bg-background p-1" value={language} onChange={e => { cancelChat(); setError(""); setLanguage(e.target.value as "en" | "vi"); }}><option value="en">English</option><option value="vi">Tiếng Việt</option></select></label>
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
    {open && <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-background shadow-sm dark:border-indigo-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-indigo-50/70 px-4 py-3 dark:bg-indigo-950/40">
        <div className="flex items-center gap-3"><span className="rounded-xl bg-indigo-600 p-2 text-white"><Sparkles aria-hidden="true" className="size-5" /></span><div><h3 className="font-semibold">{text("Your AI course guide", "AI đồng hành chọn khóa học")}</h3><p className="text-xs text-muted-foreground">{text("Find a course that fits your next step", "Chọn khóa học phù hợp với bước tiếp theo")}</p></div></div>
        <Button size="sm" variant="ghost" onClick={clear}>{text("Clear chat", "Xóa trò chuyện")}</Button>
      </div>
      <div className="relative">
        <div ref={logRef} role="log" aria-label={text("Course conversation", "Trò chuyện về khóa học")} aria-live="polite" aria-busy={pending} onScroll={() => { const log=logRef.current; if (log) { followLatest.current=log.scrollHeight-log.scrollTop-log.clientHeight < 48; if (followLatest.current) setShowLatest(false); } }} className="max-h-[26rem] min-h-48 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
          {!messages.length && <div className="mx-auto max-w-lg space-y-2 py-5 text-center"><h4 className="font-medium">{text("What would you like to learn next?", "Bạn muốn học gì tiếp theo?")}</h4><p className="text-sm leading-relaxed text-muted-foreground">{text("Share your goal and experience. I'll help narrow the available courses using your saved learning preferences.", "Chia sẻ mục tiêu và kinh nghiệm. Tôi sẽ giúp chọn khóa học từ danh mục theo sở thích học tập đã lưu.")}</p></div>}
          {messages.map((m,i) => <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && <span aria-hidden="true" className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-100"><Sparkles className="size-4" /></span>}
            <div className={`max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-[85%] ${m.role === "user" ? "rounded-br-sm bg-indigo-600 text-white" : "rounded-bl-sm bg-muted text-foreground"}`}><span className="mb-1 block text-xs font-semibold opacity-80">{m.role === "user" ? text("You", "Bạn") : "AI"}</span>{m.role === "assistant" ? courseReplyText(m.content) : m.content}</div>
          </div>)}
          {pending && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="size-4 animate-spin" />{text("Choosing courses…", "Đang chọn khóa học…")}</p>}
        </div>
        {showLatest && <Button type="button" variant="secondary" size="sm" className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full shadow" onClick={() => { const log=logRef.current; if (log) log.scrollTop=log.scrollHeight; followLatest.current=true; setShowLatest(false); }}><ChevronDown className="mr-1 size-4" />{text("Latest message", "Tin nhắn mới nhất")}</Button>}
      </div>
      <div className="space-y-3 border-t bg-muted/20 p-3 sm:p-4">
        <div className="flex flex-wrap gap-2" aria-label={text("Suggested questions", "Câu hỏi gợi ý")}>
          {(messages.length ? [text("Something easier", "Dễ hơn"), text("Show me shorter courses", "Gợi ý khóa học ngắn hơn"), text("Why this course?", "Tại sao chọn khóa này?")] : [text("Help me choose a beginner course", "Giúp tôi chọn khóa học cơ bản"), text("Show me shorter courses", "Gợi ý khóa học ngắn hơn")]).map(prompt => <Button key={prompt} type="button" variant="outline" size="sm" className="h-auto max-w-full whitespace-normal rounded-full py-1.5 text-left text-xs" disabled={pending || saving} onClick={() => { setInput(prompt); inputRef.current?.focus(); }}>{prompt}</Button>)}
        </div>
        <form className="flex items-end gap-2 rounded-xl border bg-background p-2 focus-within:ring-2 focus-within:ring-ring" onSubmit={e => { e.preventDefault(); void send(); }}>
          <textarea rows={1} className="min-h-12 max-h-36 min-w-0 flex-1 resize-none bg-transparent px-2 py-3 text-sm focus-visible:outline-none" ref={inputRef} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} aria-label={text("Your course question", "Câu hỏi về khóa học")} placeholder={text("Describe your goal, experience, or preferred course length…", "Mô tả mục tiêu, kinh nghiệm hoặc thời lượng khóa học…")} maxLength={1000} value={input} onChange={e => setInput(e.target.value)} />
          {pending ? <Button type="button" variant="outline" onClick={stop}><Square aria-hidden="true" className="mr-1 size-4" />{text("Stop", "Dừng")}</Button> : <Button disabled={saving || !input.trim()} type="submit"><Send aria-hidden="true" className="mr-1 size-4" />{text("Send", "Gửi")}</Button>}
        </form>
        <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"><p>{text("Enter to send · Shift+Enter for a new line", "Enter để gửi · Shift+Enter để xuống dòng")}</p><span aria-live="off">{input.length}/1000</span></div>
        {retryTurn && <Button type="button" size="sm" variant="outline" disabled={pending || saving} onClick={() => void send(true)}><RotateCcw className="mr-1 size-4" />{text("Retry message", "Gửi lại tin nhắn")}</Button>}
        {cards && !pending && <p role="status" className="text-xs text-muted-foreground">{text(`${visible.length} matching courses below · Review course details before enrolling.`, `${visible.length} khóa học phù hợp bên dưới · Xem chi tiết trước khi đăng ký.`)}</p>}
        {aiStatus && aiStatus !== "AVAILABLE" && aiStatus !== "NOT_NEEDED" && <p role="status" className="text-xs text-muted-foreground">{text("AI unavailable or request limit reached. Showing catalog-based suggestions.", "AI không khả dụng hoặc đã đạt giới hạn. Đang hiển thị gợi ý từ danh mục.")}</p>}
      </div>
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
