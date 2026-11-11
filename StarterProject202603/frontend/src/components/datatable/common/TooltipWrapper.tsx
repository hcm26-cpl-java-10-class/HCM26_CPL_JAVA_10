import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

export const TooltipWrapper = ({
                                   children,
                                   content,
                                   side = "top",
                               }: {
    children: React.ReactNode;
    content: string;
    side?: "top" | "bottom" | "left" | "right";
}) => (
    <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-[320px] break-words">{content}</TooltipContent>
    </Tooltip>
);