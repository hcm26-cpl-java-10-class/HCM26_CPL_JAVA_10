import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Check, ChevronDown, GitCommitHorizontal, LoaderCircle, Play, Save, Settings2, Tags } from "lucide-react";
import { workspaceGitApi, type GitDevelopmentRule, type GitDevelopmentRuleType } from "@/api/features/workspace-git.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/hooks/usePermissions";

const COMMIT_TYPES = ["feat", "fix", "docs", "refactor", "test", "chore"] as const;

function readableError(error: unknown) {
  const response = (error as { response?: { data?: { message?: string } } })?.response;
  return response?.data?.message ?? (error instanceof Error ? error.message : "Không thể tải hoặc lưu quy tắc. Vui lòng thử lại.");
}

export function GitDevelopmentRulesWorkspacePanel({ workspaceId }: { workspaceId: number }) {
  const { user, activeRole } = usePermissions();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["git-activity", "rules", workspaceId, user.email, activeRole],
    queryFn: ({ signal }) => workspaceGitApi.developmentRules(workspaceId, signal),
    retry: false,
  });
  const save = useMutation({
    mutationFn: workspaceGitApi.saveDevelopmentRule.bind(null, workspaceId),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["git-activity", "rules", workspaceId] }),
  });
  const validate = useMutation({
    mutationFn: () => workspaceGitApi.validateAvailableGitCommits(workspaceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["git-activity", "compliance", workspaceId] });
    },
  });

  return <Card className="overflow-hidden border-violet-200/80 shadow-sm">
    <CardHeader className="border-b bg-gradient-to-r from-violet-50 via-white to-indigo-50/70">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base"><Settings2 className="size-4 text-violet-600" />Quy tắc commit</CardTitle>
          <CardDescription>Chọn cách kiểm tra tên commit và mã công việc. Kết quả được hiển thị trong báo cáo tuân thủ.</CardDescription>
          <p className="text-xs text-muted-foreground">Quy tắc phục vụ báo cáo, không chặn thao tác push hoặc merge trên GitHub.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {query.data?.some(rule => rule.enabled) && <Button type="button" size="sm" variant="outline"
            disabled={!query.data.some(rule => rule.canManage) || validate.isPending}
            className="border-violet-200 bg-white text-violet-700 hover:bg-violet-50"
            onClick={() => validate.mutate()}>
            {validate.isPending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Play className="mr-2 size-4" />}
            Kiểm tra lại commit
          </Button>}
          <Badge variant="outline" className="border-violet-200 bg-white text-violet-700">Áp dụng chung cho Master</Badge>
        </div>
      </div>
      {validate.isSuccess && <p role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        Đã tạo {validate.data.length} kết quả kiểm tra theo quy tắc hiện tại.
      </p>}
      {validate.isError && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{readableError(validate.error)}</p>}
    </CardHeader>
    <CardContent className="grid gap-4 pt-5 xl:grid-cols-2">
      {query.isPending ? <><Skeleton className="h-64" /><Skeleton className="h-64" /></>
        : query.isError ? <div role="alert" className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 xl:col-span-2">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />{readableError(query.error)}
        </div>
        : (query.data ?? []).map(rule => <RuleEditor key={`${rule.type}:${rule.version}`} rule={rule} saving={save.isPending}
          error={save.variables?.type === rule.type && save.isError ? readableError(save.error) : null}
          saved={save.variables?.type === rule.type && save.isSuccess}
          onSave={payload => save.mutate(payload)} />)}
    </CardContent>
  </Card>;
}

function RuleEditor({ rule, saving, error, saved, onSave }: {
  rule: GitDevelopmentRule;
  saving: boolean;
  error: string | null;
  saved: boolean;
  onSave: (input: Pick<GitDevelopmentRule, "type" | "enabled" | "allowedCommitTypes" | "scopeRequired" | "taskKeyPattern">) => void;
}) {
  const [enabled, setEnabled] = useState(rule.enabled);
  const [types, setTypes] = useState<string[]>(rule.allowedCommitTypes);
  const [scopeRequired, setScopeRequired] = useState(rule.scopeRequired);
  const [pattern, setPattern] = useState(rule.taskKeyPattern);
  const defaultPattern = rule.defaultTaskKeyPattern ?? rule.taskKeyPattern;
  const example = rule.taskKeyExample ?? "FA-123";
  const [advanced, setAdvanced] = useState(rule.taskKeyPattern !== defaultPattern);
  const conventional = rule.type === "CONVENTIONAL_COMMIT";
  const Icon = conventional ? GitCommitHorizontal : Tags;
  const dirty = enabled !== rule.enabled || scopeRequired !== rule.scopeRequired
    || pattern !== rule.taskKeyPattern || types.join(",") !== rule.allowedCommitTypes.join(",");

  const toggleType = (type: string) => setTypes(current => current.includes(type)
    ? current.filter(item => item !== type) : [...current, type]);

  return <section className={`flex flex-col rounded-xl border p-4 sm:p-5 ${conventional ? "border-sky-200 bg-sky-50/40" : "border-emerald-200 bg-emerald-50/35"}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className={`grid size-10 place-items-center rounded-xl ${conventional ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}><Icon className="size-5" /></span>
        <div><h3 className="font-semibold text-slate-900">{conventional ? "Cách đặt tên commit" : "Mã công việc trong commit"}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{rule.version ? `Đã lưu phiên bản ${rule.version}` : "Chưa lưu quy tắc"}
            {dirty && <span className="ml-2 font-medium text-amber-700">Có thay đổi chưa lưu</span>}</p></div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Switch aria-label={conventional ? "Bật kiểm tra tên commit" : "Bật kiểm tra mã công việc"} checked={enabled}
          disabled={!rule.canManage || saving} onCheckedChange={setEnabled}
          className={conventional ? "data-[state=checked]:bg-sky-700" : "data-[state=checked]:bg-emerald-700"} />
        <span className={`text-xs font-semibold ${enabled ? "text-emerald-700" : "text-slate-500"}`}>{enabled ? "Đang bật" : "Đang tắt"}</span>
      </div>
    </div>

    {conventional ? <div className="mt-5 space-y-4">
      <p className="text-sm text-slate-600">Tên commit bắt đầu bằng loại công việc, ví dụ <code className="rounded bg-white px-1.5 py-0.5 text-sky-800">feat(auth): thêm đăng nhập</code>.</p>
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Các loại commit được chấp nhận</p>
        <div className="flex flex-wrap gap-2">{COMMIT_TYPES.map(type => <label key={type}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${types.includes(type) ? "border-sky-300 bg-white text-sky-800 shadow-sm" : "border-slate-200 bg-white/60 text-slate-500"}`}>
          <input type="checkbox" checked={types.includes(type)} disabled={!rule.canManage || saving}
            onChange={() => toggleType(type)} className="sr-only" />{types.includes(type) && <Check className="size-3" />}{type}
        </label>)}</div>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-white bg-white/80 p-3 text-sm">
        <input type="checkbox" checked={scopeRequired} disabled={!rule.canManage || saving}
          onChange={event => setScopeRequired(event.target.checked)} className="mt-0.5 size-4 accent-sky-600" />
        <span><span className="font-medium text-slate-800">Yêu cầu tên phạm vi trong ngoặc</span><span className="mt-0.5 block text-xs text-muted-foreground">Ví dụ feat(auth). Khi tắt, có thể ghi feat: thêm đăng nhập.</span></span>
      </label>
    </div> : <div className="mt-5 space-y-4">
      <p className="text-sm leading-relaxed text-slate-600">Ghi mã công việc vào commit để truy ra phần việc đã thực hiện. Lấy mã từ thẻ công việc trong Kanban hoặc Backlog.</p>
      <div className="rounded-xl border border-emerald-200 bg-white p-4">
        <p className="text-xs font-semibold text-emerald-800">Ví dụ cách ghi</p>
        <code className="mt-2 block break-words text-sm leading-relaxed text-slate-900">feat(auth): thêm đăng nhập {example}</code>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">Thay <span className="font-semibold text-emerald-700">{example}</span> bằng mã công việc thực tế.</p>
      </div>
      <p className="text-xs leading-relaxed text-slate-600">Khi bật, hệ thống tìm mã trong commit và kiểm tra công việc có tồn tại trong cùng Master. Kết quả cho biết mã hợp lệ, bị thiếu hoặc nằm ngoài dự án.</p>
      <details className="group rounded-lg border border-emerald-200/80 bg-white/70" open={advanced}
        onToggle={event => setAdvanced(event.currentTarget.open)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-xs font-semibold text-emerald-800">
          Tùy chỉnh định dạng mã <span className="ml-auto font-normal text-slate-500">Nâng cao</span>
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-emerald-100 p-3 sm:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <label htmlFor={`task-pattern-${rule.type}`} className="text-xs font-medium text-slate-700">Biểu thức nhận diện mã (regex)</label>
            <Input id={`task-pattern-${rule.type}`} value={pattern} disabled={!rule.canManage || saving}
              onChange={event => setPattern(event.target.value)} aria-describedby={`task-pattern-help-${rule.type}`}
              className="border-emerald-200 bg-white font-mono text-xs" />
            <p className="text-xs leading-relaxed text-muted-foreground">Định dạng giúp hệ thống tìm mã công việc trong tên commit. Nếu dùng mã có sẵn của Workspace, giữ mặc định.</p>
            <Button type="button" variant="outline" size="sm" className="h-auto whitespace-normal border-emerald-200 py-2 text-xs text-emerald-800"
              disabled={!rule.canManage || saving || pattern === defaultPattern} onClick={() => setPattern(defaultPattern)}>
              Dùng định dạng mặc định
            </Button>
          </div>
          <aside id={`task-pattern-help-${rule.type}`} aria-label="Hướng dẫn định dạng mã"
            className="min-w-0 space-y-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs leading-relaxed text-slate-700">
            <h4 className="font-semibold text-sky-900">Cách dùng định dạng mã</h4>
            <p>Ví dụ <code className="rounded bg-white px-1 font-semibold text-sky-800">{example}</code>: phần trước dấu <strong>-</strong> là tiền tố của Workspace, phần sau là số công việc.</p>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1.5">
              <dt className="font-mono text-sky-800">(?i)</dt><dd>Không phân biệt chữ hoa, chữ thường.</dd>
              <dt className="font-mono text-sky-800">\Q...\E</dt><dd>Giữ nguyên phần chữ ở giữa, ví dụ tiền tố Workspace.</dd>
              <dt className="font-mono text-sky-800">\d+</dt><dd>Một hoặc nhiều chữ số, ví dụ 1, 42, 123.</dd>
              <dt className="font-mono text-sky-800">\b</dt><dd>Nhận diện mã riêng biệt, tránh lấy nhầm một phần của từ khác.</dd>
            </dl>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Giữ mặc định hoặc sửa theo quy ước mã của nhóm.</li>
              <li>Bật kiểm tra mã công việc và bấm <strong>Lưu quy tắc</strong>.</li>
              <li>Bấm <strong>Kiểm tra lại commit</strong> để xem kết quả.</li>
            </ol>
            <p className="border-t border-sky-200 pt-2 text-sky-900">Ô này không tạo công việc mới. Mã tìm thấy vẫn phải trỏ đến công việc đang tồn tại trong cùng Master.</p>
          </aside>
        </div>
      </details>
    </div>}

    {!rule.canManage && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
      Người quản lý Master phụ trách cấu hình quy tắc chung cho các module.
    </p>}
    {error && <p role="alert" className="mt-4 flex items-center gap-2 text-sm text-rose-700"><AlertCircle className="size-4" />{error}</p>}
    {saved && !dirty && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-emerald-700"><Check className="size-4" />Đã lưu quy tắc.</p>}
    <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-white/80 pt-5">
      <span className="mt-5 max-w-64 text-xs leading-relaxed text-muted-foreground">Lưu để áp dụng thay đổi cho lần kiểm tra tiếp theo.</span>
      <Button type="button" size="sm" disabled={!rule.canManage || saving} className={`mt-5 ${conventional ? "bg-sky-700 hover:bg-sky-800" : "bg-emerald-700 hover:bg-emerald-800"}`}
        onClick={() => onSave({ type: rule.type as GitDevelopmentRuleType, enabled, allowedCommitTypes: types,
          scopeRequired, taskKeyPattern: pattern })}>
        {saving ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}Lưu quy tắc
      </Button>
    </div>
  </section>;
}
