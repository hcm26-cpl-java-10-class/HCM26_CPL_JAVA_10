import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { initialsOf } from "../../git-integration.format";
import { contributorTone } from "../git-integration.styles";

/**
 * WS-GH-01: initials avatar of a GitHub author. No image is loaded from GitHub;
 * the soft tone is stable per login so the same person keeps the same colour.
 */
export function ContributorAvatar({ login, className }: { login?: string | null; className?: string }) {
  return <Avatar aria-hidden="true" className={cn("size-5", className)}>
    <AvatarFallback className={cn("text-[9px] font-semibold", contributorTone(login))}>{initialsOf(login)}</AvatarFallback>
  </Avatar>;
}
