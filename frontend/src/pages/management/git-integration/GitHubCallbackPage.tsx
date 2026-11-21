import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  LockKeyhole,
  RotateCcw,
  TriangleAlert,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  gitIntegrationApi,
  gitIntegrationErrorCode,
  gitIntegrationHttpStatus,
} from "@/api/features/git-integration.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import type { RootState } from "@/store/store";
import type { GitHubCallbackRequest } from "@/types/features/git-integration";
import { GitHubTile } from "./components/GitIntegrationHeader";
import { GitIntegrationStateCard } from "./components/GitIntegrationPageState";
import {
  accountErrorMessage, errorMessage, outcomeMessage, type GitIntegrationMessage, type GitIntegrationTone,
} from "./git-integration.messages";
import {
  clearPendingAccountConnect, clearPendingConnect, readPendingAccountConnect, readPendingConnect,
} from "./git-integration.storage";
import { gitIntegrationKeys } from "./useGitIntegration";

const AUTO_REDIRECT_MS = 3000;
const INTEGRATION_PATH = "/git-integration";

type CallbackView =
  | { kind: "verifying" }
  | { kind: "result"; message: GitIntegrationMessage; account?: string; returnTo?: string };

/**
 * US-GI-06: GitHub sends both flows to this page. "Connect GitHub account" is recognised by the
 * marker saved when it started; without any marker, a callback without installation parameters
 * can only come from the account flow (an App install always carries installation_id or setup_action).
 */
function isAccountFlow(payload: GitHubCallbackRequest | undefined, account: ReturnType<typeof readPendingAccountConnect>) {
  if (account) return true;
  if (readPendingConnect()) return false;
  return !!payload && payload.installationId === undefined && !payload.setupAction;
}

const TONE_ICONS: Record<GitIntegrationTone, LucideIcon> = {
  success: CheckCircle2,
  warning: TriangleAlert,
  error: XCircle,
  neutral: LockKeyhole,
  info: Clock3,
};

/** Reads GitHub's query parameters once; `installation_id` is numeric when present. */
function readCallback(search: string): GitHubCallbackRequest | undefined {
  const params = new URLSearchParams(search);
  const state = params.get("state");
  if (!state) return undefined;
  const installation = params.get("installation_id");
  const installationId = installation && /^\d+$/.test(installation) ? Number(installation) : undefined;
  return {
    state,
    code: params.get("code") ?? undefined,
    installationId,
    setupAction: params.get("setup_action") ?? undefined,
    error: params.get("error") ?? undefined,
    errorDescription: params.get("error_description") ?? undefined,
  };
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * GI-01 callback: GitHub redirects here after install + authorization.
 * The page forwards the parameters to the backend exactly once, removes the
 * one-time code from the address bar, and explains the result.
 */
export default function GitHubCallbackPage() {
  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Captured on first render, before the URL is cleaned.
  const payloadRef = useRef<GitHubCallbackRequest | undefined | null>(null);
  if (payloadRef.current === null) payloadRef.current = readCallback(location.search);
  const accountRef = useRef<ReturnType<typeof readPendingAccountConnect> | null>(null);
  if (accountRef.current === null) accountRef.current = readPendingAccountConnect();
  const [accountFlow] = useState(() => isAccountFlow(payloadRef.current ?? undefined, accountRef.current ?? undefined));
  const startedRef = useRef(false);
  const [view, setView] = useState<CallbackView>({ kind: "verifying" });

  useEffect(() => {
    // React StrictMode runs effects twice in development; the code is single-use.
    if (startedRef.current) return;
    startedRef.current = true;
    if (location.search) navigate(location.pathname, { replace: true });

    const payload = payloadRef.current;
    if (!isAuthenticated) {
      setView({ kind: "result", message: errorMessage("UNAUTHENTICATED") });
      return;
    }
    if (!payload) {
      setView({ kind: "result", message: errorMessage("GIT_STATE_INVALID") });
      return;
    }

    if (accountFlow) {
      const returnTo = accountRef.current?.returnTo ?? "/";
      clearPendingAccountConnect();
      gitIntegrationApi.accountCallback({
        state: payload.state, code: payload.code, error: payload.error, errorDescription: payload.errorDescription,
      }).then(result => {
        void queryClient.invalidateQueries({ queryKey: gitIntegrationKeys.all });
        // Straight back to where Connect was clicked: the toast carries the result.
        toast.success("GitHub connected", {
          description: result.account ? `Activity of @${result.account.login} now counts for you in ${result.master.name ?? "this project"}.` : undefined,
        });
        navigate(returnTo, { replace: true });
      }).catch(error => {
        setView({ kind: "result", message: accountErrorMessage(gitIntegrationErrorCode(error), gitIntegrationHttpStatus(error)), returnTo });
      });
      return;
    }

    gitIntegrationApi.callback(payload).then(result => {
      if (result.outcome !== "PENDING_APPROVAL") clearPendingConnect();
      void queryClient.invalidateQueries({ queryKey: gitIntegrationKeys.all });
      setView({ kind: "result", message: outcomeMessage(result.outcome), account: result.installation?.accountLogin });
    }).catch(error => {
      const code = gitIntegrationErrorCode(error);
      // A denial is a finished attempt: drop the "not completed" hint.
      if (code === "GIT_AUTHORIZATION_DENIED") clearPendingConnect();
      setView({ kind: "result", message: errorMessage(code, gitIntegrationHttpStatus(error)) });
    });
    // Runs once by design (guarded above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move focus to the result heading so screen readers announce it.
  useEffect(() => {
    if (view.kind === "result") titleRef.current?.focus();
  }, [view]);

  // Success: return to Git Integration automatically, with a toast.
  const success = view.kind === "result" && view.message.tone === "success";
  useEffect(() => {
    if (!success || view.kind !== "result" || prefersReducedMotion()) return;
    const timer = window.setTimeout(() => goToIntegration(view.message, view.account), AUTO_REDIRECT_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  function goToIntegration(message?: GitIntegrationMessage, account?: string) {
    if (message?.tone === "success") toast.success(message.title, { description: account ? `Connected ${account}` : undefined });
    navigate(INTEGRATION_PATH, { replace: true });
  }

  const content = view.kind === "verifying"
    ? <GitIntegrationStateCard icon={Loader2} iconClassName="animate-spin motion-reduce:animate-none" tone="info" live
      title={accountFlow ? "Verifying your GitHub account…" : "Verifying your GitHub installation…"}
      description={accountFlow ? "We're confirming the account is yours. You'll be back in a moment."
        : "We're confirming the installation belongs to you. This only takes a moment."} />
    : <ResultCard view={view} titleRef={titleRef} onContinue={goToIntegration} />;

  if (!isAuthenticated) {
    // Outside the app shell: the sidebar needs a signed-in user.
    return <div className="flex min-h-screen items-center justify-center bg-slate-50/70 px-4 dark:bg-background">{content}</div>;
  }
  return <MainLayout contentClassName="bg-slate-50/70 dark:bg-background"
    pathName={{ "git-integration": "Git Integration", github: "GitHub", callback: "Verification" }}
    pathLinks={{ "git-integration": INTEGRATION_PATH }}>
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-2 py-8">
      <GitHubTile size="sm" />
      {content}
    </div>
  </MainLayout>;
}

function ResultCard({ view, titleRef, onContinue }: {
  view: Extract<CallbackView, { kind: "result" }>;
  titleRef: Ref<HTMLHeadingElement>;
  onContinue: (message?: GitIntegrationMessage, account?: string) => void;
}) {
  const { message, account, returnTo } = view;
  let actions: ReactNode;
  if (returnTo) {
    // US-GI-06: back to the GitHub tab the user came from, where the banner lets them try again.
    actions = <Button asChild><Link to={returnTo} replace><RotateCcw />Back to the GitHub tab</Link></Button>;
  } else switch (message.action) {
    case "integration":
      actions = <Button onClick={() => onContinue(message, account)}>Back to Git Integration<ArrowRight /></Button>;
      break;
    case "retry":
      actions = <Button asChild><Link to={INTEGRATION_PATH} replace><RotateCcw />Start again</Link></Button>;
      break;
    case "signin":
      actions = <Button asChild><Link to="/login" replace>Sign in</Link></Button>;
      break;
    default:
      actions = <Button variant="outline" asChild><Link to="/" replace><ArrowLeft />Back to dashboard</Link></Button>;
  }

  return <GitIntegrationStateCard icon={TONE_ICONS[message.tone]} tone={message.tone} live titleRef={titleRef}
    title={account && message.tone === "success" ? `${message.title} · ${account}` : message.title}
    description={<>
      <p>{message.description}</p>
      {message.tone === "success" && !prefersReducedMotion() &&
        <p className="mt-1 text-xs">Taking you back to Git Integration…</p>}
    </>}>
    {actions}
  </GitIntegrationStateCard>;
}
