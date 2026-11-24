import type { LucideIcon } from "lucide-react";
import type { ReactNode, Ref } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { GitIntegrationTone } from "../git-integration.messages";
import { TONE_STYLES } from "./git-integration.styles";

/** Centered status card (403 / 404 / disabled / callback results), same shape as Analytics. */
export function GitIntegrationStateCard({ icon: Icon, iconClassName, tone = "neutral", title, description, children, live, titleRef }: {
  icon: LucideIcon;
  iconClassName?: string;
  tone?: GitIntegrationTone;
  title: string;
  description: ReactNode;
  children?: ReactNode;
  /** Announce changes to screen readers (callback screen). */
  live?: boolean;
  titleRef?: Ref<HTMLHeadingElement>;
}) {
  const style = TONE_STYLES[tone];
  return <Card className={cn("w-full max-w-lg border", style.ring)}>
    <CardContent className="flex flex-col items-center gap-3 py-10 text-center"
      role={live ? "status" : undefined} aria-live={live ? "polite" : undefined}>
      <span className={cn("flex size-12 items-center justify-center rounded-full", style.tile)}>
        <Icon className={cn("size-6", iconClassName)} aria-hidden="true" />
      </span>
      <div className="space-y-1.5">
        <h1 ref={titleRef} tabIndex={-1} className="text-lg font-semibold tracking-tight outline-none">{title}</h1>
        <div className="mx-auto max-w-md text-sm leading-6 text-muted-foreground">{description}</div>
      </div>
      {children && <div className="mt-2 flex flex-wrap items-center justify-center gap-2">{children}</div>}
    </CardContent>
  </Card>;
}
