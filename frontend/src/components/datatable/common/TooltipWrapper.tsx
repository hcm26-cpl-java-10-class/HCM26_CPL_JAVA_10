import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const TooltipWrapper = ({
                                   children,
                                   content,
                                   side = "top",
                                   portal = true,
                                   contentClassName,
                               }: {
    children: React.ReactNode;
    content: string;
    side?: "top" | "bottom" | "left" | "right";
    portal?: boolean;
    contentClassName?: string;
}) => (
    <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
            side={side}
            portal={portal}
            className={cn("max-w-[320px] break-words", contentClassName)}
        >
            {content}
        </TooltipContent>
    </Tooltip>
);
