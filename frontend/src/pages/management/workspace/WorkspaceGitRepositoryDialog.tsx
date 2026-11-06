import { useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, GitBranch, Hash, Info, Link2, Monitor, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import { SiBitbucket, SiGithub, SiGitlab } from "react-icons/si";
import type { WorkspaceGitInput } from "@/api/features/workspace-git.api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { WorkspaceFormDialog } from "./WorkspaceFormDialog";

const PROVIDERS = [
  { id: "github", label: "GitHub", host: "github.com", icon: SiGithub, color: "text-foreground" },
  { id: "gitlab", label: "GitLab", host: "gitlab.com", icon: SiGitlab, color: "text-orange-600" },
  { id: "bitbucket", label: "Bitbucket", host: "bitbucket.org", icon: SiBitbucket, color: "text-blue-600" },
  { id: "self", label: "Tự lưu trữ", host: "git.company.com", icon: Monitor, color: "text-muted-foreground" },
] as const;
type Provider = typeof PROVIDERS[number]["id"];

function repositoryInfo(raw: string) {
  try {
    const value = raw.trim();
    if (!value || /\s/.test(value)) return null;
    const url = new URL(value.startsWith("git@") ? `ssh://${value.replace(":", "/")}` : value);
    if (!["https:", "ssh:"].includes(url.protocol) || url.search || url.hash || url.password
      || (url.protocol === "https:" ? !!url.username : url.username !== "git")) return null;
    const parts = url.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/, "").split("/");
    if (!url.hostname.includes(".") || parts.length < 2 || parts.some(part => !part || part === "." || part === "..")) return null;
    const provider: Provider = url.hostname === "github.com" ? "github" : url.hostname === "gitlab.com" ? "gitlab" : url.hostname === "bitbucket.org" ? "bitbucket" : "self";
    const azure = url.hostname === "dev.azure.com" || url.hostname === "ssh.dev.azure.com" || url.hostname.endsWith(".visualstudio.com");
    return { host: url.hostname, path: parts.join("/"), provider, ssh: url.protocol === "ssh:", selfHosted: provider === "self" && !azure, label: azure ? "Azure DevOps" : PROVIDERS.find(item => item.id === provider)!.label };
  } catch { return null; }
}

export function WorkspaceGitRepositoryDialog({ workspaceId, configured, value, onChange, onClose, onSave,
  busy, disabled, error, onReload, reloading }: {
  workspaceId: number;
  configured: boolean;
  value: WorkspaceGitInput;
  onChange: (value: WorkspaceGitInput) => void;
  onClose: () => void;
  onSave: (value: WorkspaceGitInput) => void;
  busy: boolean;
  disabled: boolean;
  error: { message: string; fields: Record<string, string>; conflict: boolean } | null;
  onReload: () => void;
  reloading: boolean;
}) {
  const info = repositoryInfo(value.repositoryUrl);
  const [provider, setProvider] = useState<Provider>(() => info?.provider ?? "github");
  const [protocol, setProtocol] = useState(() => info?.ssh || value.repositoryUrl.startsWith("ssh:") || value.repositoryUrl.startsWith("git@") ? "SSH" : "HTTPS");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const urlInput = useRef<HTMLInputElement>(null);
  const advanced = useRef<HTMLDetailsElement>(null);
  const exampleHost = PROVIDERS.find(item => item.id === provider)!.host;
  const example = protocol === "SSH" ? `git@${exampleHost}:ten-to-chuc/ten-repo.git` : `https://${exampleHost}/ten-to-chuc/ten-repo.git`;
  const fieldId = (name: string) => `git-${workspaceId}-${name}`;
  const fieldMessage = (name: string) => errors[name] || error?.fields[name];
  const fieldError = (name: string) => fieldMessage(name) ? <p id={`${fieldId(name)}-error`} role="alert" className="text-xs text-destructive">{fieldMessage(name)}</p> : null;
  function updateUrl(url: string) {
    const parsed = repositoryInfo(url);
    if (parsed) { setProvider(parsed.provider); setProtocol(parsed.ssh ? "SSH" : "HTTPS"); }
    setErrors(current => ({ ...current, repositoryUrl: "" }));
    onChange({ ...value, repositoryUrl: url });
  }

  return <WorkspaceFormDialog open onOpenChange={open => { if (!open) onClose(); }} busy={busy} submitDisabled={disabled}
    title={configured ? "Chỉnh sửa Git Repository" : "Liên kết Git Repository"}
    description="Liên kết kho mã nguồn để nhóm truy cập repository và quản lý thông tin nộp bài."
    icon={GitBranch} badge={<Badge variant="outline" className="border-blue-200 bg-blue-50 text-[10px] font-normal text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400">HTTPS / SSH</Badge>}
    submitLabel={configured ? "Lưu thay đổi" : "Liên kết Repository"} submitIcon={Check}
    onSubmit={event => {
      event.preventDefault();
      if (busy || disabled) return;
      const next: Record<string, string> = {};
      if (!value.repositoryUrl.trim()) next.repositoryUrl = "Vui lòng nhập URL clone repository.";
      if (!value.defaultBranch.trim()) next.defaultBranch = "Vui lòng nhập nhánh mặc định.";
      if (info?.selfHosted && info.ssh && !value.repositoryWebUrl?.trim()) next.repositoryWebUrl = "Vui lòng nhập trang HTTPS của repository trên máy chủ nội bộ.";
      setErrors(next);
      if (next.repositoryWebUrl && advanced.current) advanced.current.open = true;
      if (!Object.keys(next).length) onSave(value);
    }}>
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs leading-5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" /><p><strong>Lưu ý an toàn:</strong> Không đính kèm Personal Access Token, mật khẩu hoặc Private Key trong URL.</p>
    </div>
    <fieldset disabled={busy} className="space-y-2">
      <legend className="mb-2 text-xs font-medium">1. Mẫu URL theo nhà cung cấp</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{PROVIDERS.map(({ id, label, icon: Icon, color }) => <Button key={id} type="button" variant="outline" aria-pressed={provider === id}
        className={cn("h-10 justify-start rounded-xl px-3 text-xs", provider === id && "border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-blue-500/10 dark:text-blue-400")}
        onClick={() => { setProvider(id); urlInput.current?.focus(); }}><Icon className={cn("size-4", color)} />{label}</Button>)}</div>
    </fieldset>
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-xs" htmlFor={fieldId("repositoryUrl")}>2. URL clone repository <span className="text-destructive">*</span></Label>
        <div role="group" aria-label="Mẫu giao thức URL" className="flex rounded-lg bg-muted p-0.5">{["HTTPS", "SSH"].map(item => <Button type="button" key={item} variant="ghost" size="xs" disabled={busy} aria-pressed={protocol === item}
          className={cn("rounded-md text-xs", protocol === item && "bg-background text-blue-600 shadow-sm dark:text-blue-400")} onClick={() => setProtocol(item)}>{item}</Button>)}</div>
      </div>
      <div className="relative">
        <Link2 className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
        <Input ref={urlInput} id={fieldId("repositoryUrl")} value={value.repositoryUrl} maxLength={2048} required disabled={busy} autoComplete="off" spellCheck={false}
          className="h-10 rounded-xl pl-9 pr-20 text-sm" placeholder={example} aria-invalid={!!fieldMessage("repositoryUrl")} aria-describedby={`${fieldId("repositoryUrl")}-hint${fieldMessage("repositoryUrl") ? ` ${fieldId("repositoryUrl")}-error` : ""}`} onChange={event => updateUrl(event.target.value)} />
        <Button type="button" variant="ghost" size="xs" className="absolute right-2 top-2 text-xs" disabled={busy} onClick={async () => {
          try { updateUrl((await navigator.clipboard.readText()).trim()); }
          catch { urlInput.current?.focus(); setErrors(current => ({ ...current, repositoryUrl: "Không đọc được clipboard. Nhấn Ctrl+V để dán URL." })); }
        }}>Dán URL</Button>
      </div>
      <p id={`${fieldId("repositoryUrl")}-hint`} className="break-all text-xs leading-5 text-muted-foreground">Ví dụ: <code className="rounded bg-muted px-1 py-0.5 text-[11px]">{example}</code></p>
      {fieldError("repositoryUrl")}
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="min-w-0 space-y-2">
        <Label className="text-xs" htmlFor={fieldId("defaultBranch")}>3. Nhánh mặc định <span className="text-destructive">*</span></Label>
        <div className="relative"><Hash className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
          <Input id={fieldId("defaultBranch")} value={value.defaultBranch} maxLength={255} required disabled={busy} spellCheck={false} autoComplete="off" placeholder="main" className="h-10 rounded-xl pl-9 font-mono text-sm"
            aria-invalid={!!fieldMessage("defaultBranch")} aria-describedby={fieldMessage("defaultBranch") ? `${fieldId("defaultBranch")}-error` : undefined}
            onChange={event => { setErrors(current => ({ ...current, defaultBranch: "" })); onChange({ ...value, defaultBranch: event.target.value }); }} />
        </div>
        <div className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground"><span>Gợi ý:</span>{["main", "master", "develop"].map(branch => <Button key={branch} type="button" size="xs" variant="secondary" className="h-5 px-1.5 font-mono text-[10px]" disabled={busy} onClick={() => { onChange({ ...value, defaultBranch: branch }); setErrors(current => ({ ...current, defaultBranch: "" })); }}>{branch}</Button>)}</div>
        {fieldError("defaultBranch")}
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium">Thông tin liên kết</p>
        <div role="status" className="flex min-h-10 items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-xs"><span className={cn("size-2 shrink-0 rounded-full", info ? "bg-blue-500" : "bg-muted-foreground/50")} />{info ? `${info.label} · ${info.ssh ? "SSH" : "HTTPS"}` : "Chờ nhập URL repository"}</div>
        <p className="text-[11px] leading-4 text-muted-foreground">Lưu liên kết chưa xác minh quyền truy cập hoặc nhánh trên dịch vụ Git.</p>
      </div>
    </div>
    <details ref={advanced} open={info?.selfHosted && info.ssh || !!fieldMessage("repositoryWebUrl") || undefined} className="group rounded-xl border bg-muted/20">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-3 text-xs font-medium"><span className="flex items-center gap-2"><Settings2 className="size-4 shrink-0 text-muted-foreground" />Cấu hình nâng cao · Self-hosted SSH</span><ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" /></summary>
      <div className="space-y-2 border-t p-3">
        <Label className="text-xs" htmlFor={fieldId("repositoryWebUrl")}>Trang web repository (HTTPS)</Label>
        <Input id={fieldId("repositoryWebUrl")} value={value.repositoryWebUrl ?? ""} maxLength={2048} disabled={busy} className="h-10 rounded-xl text-sm" autoComplete="off" spellCheck={false} placeholder="https://git.company.com/team/repository"
          aria-invalid={!!fieldMessage("repositoryWebUrl")} aria-describedby={fieldMessage("repositoryWebUrl") ? `${fieldId("repositoryWebUrl")}-error` : undefined}
          onChange={event => { setErrors(current => ({ ...current, repositoryWebUrl: "" })); onChange({ ...value, repositoryWebUrl: event.target.value }); }} />
        <p className="text-[11px] leading-5 text-muted-foreground">Bắt buộc với SSH trên máy chủ nội bộ. GitHub, GitLab, Bitbucket và Azure DevOps được nhận diện từ URL.</p>
        {fieldError("repositoryWebUrl")}
      </div>
    </details>
    {info && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-3">
      <div className="flex min-w-0 flex-1 items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 font-mono text-xs font-semibold text-white">git</span><div className="min-w-0 space-y-1"><p className="break-all text-xs font-semibold">{info.path}</p><p className="flex flex-wrap items-center gap-x-2 gap-y-1 break-all text-[11px] text-muted-foreground"><span>{info.host}</span><span className="flex items-center gap-1"><GitBranch className="size-3" />{value.defaultBranch || "Chưa nhập nhánh"}</span></p></div></div>
      <Badge variant="outline" className="gap-1 text-[10px] font-normal"><Info className="size-3" />Xem trước</Badge>
    </div>}
    {error && <div role="alert" className="space-y-2 rounded-xl border border-destructive/30 p-3 text-xs text-destructive"><p>{error.message}</p>{error.conflict && <Button type="button" size="sm" variant="outline" disabled={busy || reloading} onClick={onReload}><RefreshCw className="size-3.5" />Tải cấu hình mới nhất</Button>}</div>}
    <p className="flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-blue-600 dark:text-blue-400" />Liên kết được sử dụng trong workspace của nhóm. Chỉ người có quyền chỉnh sửa mới có thể thay đổi cấu hình.</p>
  </WorkspaceFormDialog>;
}
