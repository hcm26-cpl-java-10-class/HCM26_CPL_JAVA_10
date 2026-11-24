import { Loader2, X } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { GitAccountsOverview } from "@/types/features/git-integration";
import { useConnectAccount } from "../../useGitIntegration";

/**
 * US-GI-06: the one "Connect GitHub" action. A verified account is reused on the spot
 * ("Connect as @login"); otherwise it goes to GitHub and the callback comes straight back.
 * Shown by the banner, the repository strip and the viewer's own row in Members, so it stays
 * reachable after the banner is dismissed.
 */
export function ConnectAccountButton({ projectId, login, variant = "default", className }: {
  projectId: number;
  /** The viewer's verified GitHub login, when there is one. */
  login?: string | null;
  variant?: "default" | "outline";
  className?: string;
}) {
  const connect = useConnectAccount(projectId);
  const busy = connect.isPending || (connect.isSuccess && connect.data?.outcome === "AUTHORIZE_REQUIRED");
  return <Button size="sm" variant={variant} className={cn("h-8", className)} disabled={busy} onClick={() => connect.mutate()}>
    {busy ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : <FaGithub />}
    {busy ? (login ? "Connecting…" : "Redirecting to GitHub…") : login ? `Connect as @${login}` : "Connect GitHub"}
  </Button>;
}

/**
 * US-GI-06: asks a member who has not connected GitHub in this master project to do it, in one
 * click. A verified account is reused on the spot ("Connect as @login"); otherwise the button
 * goes to GitHub and the callback comes straight back here. "Not now" (`onSnooze`) hides it for a
 * week; the parent keeps that state so it can show a compact button instead.
 */
export function ConnectAccountBanner({ projectId, overview, onSnooze }: {
  projectId: number;
  overview: GitAccountsOverview;
  onSnooze: () => void;
}) {
  const { viewer, master } = overview;

  return <section aria-label="Connect your GitHub account"
    className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border border-amber-200/80 bg-amber-50/40 px-4 py-3 dark:border-amber-900/70 dark:bg-amber-950/20">
    <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-white dark:text-slate-900">
      <FaGithub className="size-4" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold">Link your GitHub account</p>
      <p className="text-xs text-muted-foreground">
        Your commits, pull requests and reviews in <span className="font-medium text-foreground">{master.name ?? "this project"}</span> and its modules will count for you.
      </p>
    </div>
    <div className="flex w-full items-center gap-1 sm:w-auto">
      <ConnectAccountButton projectId={projectId} login={viewer.identity?.login} className="flex-1 sm:flex-none" />
      <Button variant="ghost" size="sm" className="h-8 px-2 text-muted-foreground"
        aria-label="Not now — hide for 7 days" title="Not now (hide for 7 days)"
        onClick={onSnooze}>
        <X />
      </Button>
    </div>
  </section>;
}
