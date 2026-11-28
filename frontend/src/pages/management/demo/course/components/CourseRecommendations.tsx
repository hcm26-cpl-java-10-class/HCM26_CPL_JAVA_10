import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { courseApi } from "@/api";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Loader2, Square, RotateCcw, ChevronDown, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { recommendationsApi, type Recommendation } from "@/api/features/recommendations.api";
import { recommendationContext, type RecommendationTurn, courseReplyText, recommendationPage, RecommendationRequest, readRecommendationHistory, recommendationHistoryKey } from "@/utils/recommendation-session";
import { useCourseBookmarks } from "../hooks/useCourseBookmarks";
import { useCourseEnrollment } from "../hooks/useCourseEnrollment";
import { CourseCard, CourseCardSkeleton } from "./CourseCard";
import { filterAndSortRecommendations, catalogCategoryNames, recommendationCategoryNames, recommendationFilterLabels, type DurationFilter, type RatingFilter, type RecommendationFilters } from "./recommendation-filters";
import type { CategoryTreeDTO, CourseLevel } from "@/types";

const defaultFilters: RecommendationFilters = { categories: [], levels: [], durations: [], ratings: [], sort: "best" };

interface CourseRecommendationsProps {
  search?: string;
  filters?: RecommendationFilters;
  onFiltersChange?: (filters: RecommendationFilters) => void;
  page?: number;
  onPageChange?: (page: number) => void;
}

export function CourseRecommendations(props: CourseRecommendationsProps) {
  const { user } = useAuth();
  const { activeRole, hasPermission } = usePermissions();
  if (!user?.email || activeRole !== "STUDENT" || !hasPermission("ENROLLMENT_CREATE")) return null;
  return <AccountRecommendations key={user.email} account={user.email} {...props} />;
}

function AccountRecommendations({ account, search = "", filters: controlledFilters, onFiltersChange, page: controlledPage, onPageChange }: { account: string } & CourseRecommendationsProps) {
  const client = useQueryClient();
  const queryKey = ["course-recommendations", account];
  const query = useQuery({ queryKey, queryFn: ({ signal }) => recommendationsApi.get(signal), staleTime: 0, gcTime: 0, retry: 1 });
  const categoryQuery = useQuery({ queryKey: ["course-catalog-categories"], queryFn: courseApi.getCatalogCategories, staleTime: 5 * 60 * 1000 });
  const categoryTree = categoryQuery.data ?? [];
  const { canEnroll, enrollMutation, enrollmentByCourseId } = useCourseEnrollment();
  const { canBookmark, savedCourseIds, togglingCourseId, toggleBookmark } = useCourseBookmarks();
  const request = useRef(new RecommendationRequest());
  const action = useRef(new RecommendationRequest());
  const locked = useRef(false);
  const [localPage, setLocalPage] = useState(1);
  const [localFilters, setLocalFilters] = useState(defaultFilters);
  const filters = controlledFilters ?? localFilters;
  const page = controlledPage ?? localPage;
  const setPage = onPageChange ?? setLocalPage;
  const setFilters = onFiltersChange ?? setLocalFilters;
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
  const eligible = (cards ?? query.data?.recommendations ?? []).filter(item => !enrollmentByCourseId.has(item.course.id));
  const searchMatches = filterAndSortRecommendations(eligible, search, defaultFilters, categoryTree);
  const visible = filterAndSortRecommendations(eligible, search, filters, categoryTree);
  const categories = [...new Set([...catalogCategoryNames(categoryTree), ...searchMatches.flatMap(item => recommendationCategoryNames(item.course, categoryTree)), ...filters.categories])].sort((a, b) => a.localeCompare(b));
  const hasReviewedCourses = searchMatches.some(item => item.course.totalReviews > 0);
  const activeFilterCount = filters.categories.length + filters.levels.length + filters.durations.length + filters.ratings.length;
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
      <Button size="lg" className="min-h-11 w-full whitespace-normal shadow-sm sm:w-auto" aria-controls="course-ai-chooser" aria-expanded={open} onClick={() => setOpen(!open)}><Sparkles aria-hidden="true" />{text("Ask AI to help me choose", "Nhờ AI giúp chọn khóa học")}</Button>
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
    {open && <div id="course-ai-chooser" className="overflow-hidden rounded-2xl border border-indigo-200 bg-background shadow-sm dark:border-indigo-800">
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
    {!query.isLoading && !query.isError && <p className="text-xs text-muted-foreground">Filters apply to this account's {eligible.length}-course recommendation shortlist, not the entire course catalog. All active categories are listed, including those with zero matching recommendations.</p>}
    {categoryQuery.isError && <p role="alert" className="text-sm text-muted-foreground">Category list unavailable. Showing categories from your recommendations. <Button variant="ghost" size="sm" onClick={() => void categoryQuery.refetch()}>Retry categories</Button></p>}
    <details className="rounded-xl border bg-background p-3 lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between font-medium"><span className="flex items-center gap-2"><Filter className="size-4" /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}</span><ChevronDown className="size-4" /></summary>
      <div className="pt-4"><RecommendationFilterPanel items={searchMatches} categories={categories} categoryTree={categoryTree} filters={filters} showRatings={hasReviewedCourses} onChange={next => { setFilters(next); setPage(1); }} /></div>
    </details>
    <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden border-r pr-5 lg:block" aria-label="Recommendation filters">
        <RecommendationFilterPanel items={searchMatches} categories={categories} categoryTree={categoryTree} filters={filters} showRatings={hasReviewedCourses} onChange={next => { setFilters(next); setPage(1); }} />
      </aside>
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-3">
          <div><h3 className="text-lg font-semibold">All results</h3><p role="status" className="text-sm text-muted-foreground">{visible.length} course{visible.length === 1 ? "" : "s"}</p></div>
          <label className="text-sm font-medium">Sort by <select aria-label="Sort recommendations" className="ml-2 rounded-md border bg-background px-2 py-1.5" value={filters.sort} onChange={event => { setFilters({ ...filters, sort: event.target.value as RecommendationFilters["sort"] }); setPage(1); }}><option value="best">Best match</option><option value="rating">Rating</option><option value="duration-asc">Duration: shortest</option><option value="duration-desc">Duration: longest</option></select></label>
        </div>
        {activeFilterCount > 0 && <div className="flex flex-wrap items-center gap-2" aria-label="Selected filters">
          {filters.categories.map(value => <FilterChip key={`category-${value}`} label={value} onRemove={() => { setFilters({ ...filters, categories: filters.categories.filter(item => item !== value) }); setPage(1); }} />)}
          {filters.levels.map(value => <FilterChip key={`level-${value}`} label={recommendationFilterLabels.levels[value]} onRemove={() => { setFilters({ ...filters, levels: filters.levels.filter(item => item !== value) }); setPage(1); }} />)}
          {filters.durations.map(value => <FilterChip key={`duration-${value}`} label={recommendationFilterLabels.durations[value]} onRemove={() => { setFilters({ ...filters, durations: filters.durations.filter(item => item !== value) }); setPage(1); }} />)}
          {filters.ratings.map(value => <FilterChip key={`rating-${value}`} label={recommendationFilterLabels.ratings[value]} onRemove={() => { setFilters({ ...filters, ratings: filters.ratings.filter(item => item !== value) }); setPage(1); }} />)}
          <Button type="button" variant="ghost" size="sm" onClick={() => { setFilters({ ...defaultFilters, sort: filters.sort }); setPage(1); }}>Clear all</Button>
        </div>}
        {query.isLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3].map(i => <CourseCardSkeleton key={i} />)}</div> : visible.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {paged.items.map(item => <div key={item.course.id} className="space-y-2 rounded-xl border bg-background p-2 shadow-sm">
            <p className="flex gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-100"><Sparkles className="mt-0.5 size-4 shrink-0" /><span><strong>Why this course:</strong> {vi ? translateReason(item.reason) : item.reason}</span></p>
            <CourseCard
              course={item.course}
              canEnroll={canEnroll}
              isEnrolling={enrollMutation.isPending && enrollMutation.variables === item.course.id}
              canAssign={false}
              showDetailAction
              onEnroll={enroll}
              isSaved={canBookmark && savedCourseIds.has(item.course.id)}
              isSavingBookmark={togglingCourseId === item.course.id}
              onToggleBookmark={canBookmark ? toggleBookmark : undefined}
            />
            <Button variant="ghost" size="sm" disabled={saving} aria-label={`${text("Dismiss", "Ẩn")} ${item.course.name}`} onClick={() => void update("dismiss", item.course.id)}>{text("Not suitable · Dismiss", "Không phù hợp · Ẩn")}</Button>
          </div>)}
        </div> : !query.isError && <div role="status" className="space-y-3 rounded-xl border border-dashed p-6 text-center"><p>{keyword && !activeFilterCount ? text("No recommended courses match your search. Clear or change the search to see more suggestions.", "Không có khóa học được gợi ý phù hợp với tìm kiếm. Xóa hoặc đổi từ khóa để xem thêm gợi ý.") : keyword || activeFilterCount ? text("No recommended courses match the current search and filters.", "Không có khóa học được gợi ý phù hợp với tìm kiếm và bộ lọc hiện tại.") : state === "EMPTY_CATALOG" ? text("No active published courses yet.", "Chưa có khóa học đang hoạt động và công khai.") : state === "NO_MATCHES" ? text("No matching courses. Try different preferences or another question.", "Không có khóa phù hợp. Hãy thử sở thích hoặc câu hỏi khác.") : text("No more eligible courses. You may already be enrolled or have dismissed the available courses. Reset dismissals to reconsider them.", "Không còn khóa học đủ điều kiện. Bạn có thể đã đăng ký hoặc ẩn các khóa hiện có. Đặt lại để xem lại các khóa đã ẩn.")}</p>{activeFilterCount > 0 && <Button variant="outline" onClick={() => { setFilters({ ...defaultFilters, sort: filters.sort }); setPage(1); }}>Clear filters</Button>}</div>}
        {visible.length > 6 && <nav aria-label={text("Recommendation pages", "Trang gợi ý")} className="flex items-center justify-center gap-3">
          <Button variant="outline" disabled={paged.page === 1} onClick={() => setPage(paged.page - 1)}>{text("Previous", "Trước")}</Button>
          <span role="status" className="text-sm">{text("Page", "Trang")} {paged.page} / {paged.total}</span>
          <Button variant="outline" disabled={paged.page === paged.total} onClick={() => setPage(paged.page + 1)}>{text("Next", "Sau")}</Button>
        </nav>}
      </div>
    </div>
  </section>;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <span className="inline-flex items-center gap-1 rounded-full border bg-background px-3 py-1 text-xs font-medium">{label}<button type="button" aria-label={`Remove ${label} filter`} onClick={onRemove}><X className="size-3.5" /></button></span>;
}

function RecommendationFilterPanel({ items, categories, categoryTree, filters, showRatings, onChange }: { items: Recommendation[]; categories: string[]; categoryTree: CategoryTreeDTO[]; filters: RecommendationFilters; showRatings: boolean; onChange: (filters: RecommendationFilters) => void }) {
  const toggle = <T extends string,>(values: T[], value: T) => values.includes(value) ? values.filter(item => item !== value) : [...values, value];
  const categoryCount = (value: string) => items.filter(item => recommendationCategoryNames(item.course, categoryTree).includes(value)).length;
  const levelCount = (value: CourseLevel) => items.filter(item => item.course.level === value).length;
  const durationCount = (value: DurationFilter) => items.filter(item => {
    const seconds = item.course.totalDuration;
    return seconds > 0 && (value === "under-2h" ? seconds < 7_200 : value === "2h-10h" ? seconds >= 7_200 && seconds < 36_000 : seconds >= 36_000);
  }).length;
  const ratingCount = (value: RatingFilter) => items.filter(item => {
    const { averageRating: rating, totalReviews: reviews } = item.course;
    return reviews > 0 && (value === "4.5-plus" ? rating >= 4.5 : value === "4.0-4.49" ? rating >= 4 && rating < 4.5 : rating < 4);
  }).length;
  return <div className="space-y-6">
    <div className="flex items-center justify-between"><h3 className="font-semibold">Filter by</h3>{filters.categories.length + filters.levels.length + filters.durations.length + filters.ratings.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...defaultFilters, sort: filters.sort })}>Clear</Button>}</div>
    <FilterGroup title="Category">{categories.map(value => <FilterOption key={value} label={value} count={categoryCount(value)} checked={filters.categories.includes(value)} onChange={() => onChange({ ...filters, categories: toggle(filters.categories, value) })} />)}</FilterGroup>
    <FilterGroup title="Level">{(["BEGINNER", "INTERMEDIATE", "ADVANCED"] as CourseLevel[]).map(value => <FilterOption key={value} label={recommendationFilterLabels.levels[value]} count={levelCount(value)} checked={filters.levels.includes(value)} onChange={() => onChange({ ...filters, levels: toggle(filters.levels, value) })} />)}</FilterGroup>
    <FilterGroup title="Content duration">{(["under-2h", "2h-10h", "10h-plus"] as DurationFilter[]).map(value => <FilterOption key={value} label={recommendationFilterLabels.durations[value]} count={durationCount(value)} checked={filters.durations.includes(value)} onChange={() => onChange({ ...filters, durations: toggle(filters.durations, value) })} />)}<p className="text-xs text-muted-foreground">Courses without duration metadata are excluded only when a duration filter is selected.</p></FilterGroup>
    {showRatings && <FilterGroup title="Rating">{(["4.5-plus", "4.0-4.49", "under-4"] as RatingFilter[]).map(value => <FilterOption key={value} label={recommendationFilterLabels.ratings[value]} count={ratingCount(value)} checked={filters.ratings.includes(value)} onChange={() => onChange({ ...filters, ratings: toggle(filters.ratings, value) })} />)}</FilterGroup>}
  </div>;
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return <fieldset className="space-y-2"><legend className="mb-2 font-medium">{title}</legend>{children}</fieldset>;
}

function FilterOption({ label, count, checked, onChange }: { label: string; count: number; checked: boolean; onChange: () => void }) {
  return <label className="flex cursor-pointer items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={checked} onChange={onChange} /><span className="min-w-0 flex-1">{label} <span className="text-muted-foreground">({count})</span></span></label>;
}
function translateReason(reason: string) {
  if (reason.startsWith("Matches")) return "Phù hợp với mục tiêu hoặc chủ đề bạn đã lưu.";
  if (reason.startsWith("Related")) return "Liên quan đến chủ đề trong hoạt động học của bạn.";
  if (reason.startsWith("An introductory")) return "Một lựa chọn nhập môn để khám phá.";
  return "Một lựa chọn hiện có trong danh mục để khám phá.";
}
