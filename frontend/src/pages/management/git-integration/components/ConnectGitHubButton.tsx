import { Loader2 } from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { useConnectGitHub } from "../useGitIntegration";

/**
 * Calls /connect and sends the browser to GitHub. Disabled with a
 * "Redirecting…" label from the first click so it cannot fire twice.
 */
export function ConnectGitHubButton({ label = "Connect GitHub", variant = "default", size = "default", className }: {
  label?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm";
  className?: string;
}) {
  const connect = useConnectGitHub();
  const busy = connect.isPending;
  return <Button variant={variant} size={size} className={className} disabled={busy} aria-busy={busy}
    onClick={() => connect.mutate()}>
    {busy ? <Loader2 className="animate-spin" /> : <FaGithub />}
    {busy ? "Redirecting to GitHub…" : label}
  </Button>;
}
