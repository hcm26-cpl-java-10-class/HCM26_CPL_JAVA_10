import { GripVertical } from "lucide-react";
import { TooltipWrapper } from "@/components/datatable/common/TooltipWrapper";
import { Button } from "@/components/ui/button";

interface ActionButtonProps {
  onClick: () => void;
  title?: string;
  tooltip?: string;
  variant?: "outline" | "ghost" | "default" | "destructive" | "secondary";
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

const ActionButton = ({
  onClick,
  title,
  tooltip = "Action",
  variant = "outline",
  icon = <GripVertical size={10} className="text-gray-500" />,
  disabled = false,
  className,
}: ActionButtonProps) => {
  return (
    <TooltipWrapper content={tooltip}>
      <Button
        variant={variant || "outline"}
        size={title ? "default" : "icon"}
        onClick={onClick}
        disabled={disabled}
        className={className}
      >
        {icon}
        {title && <span className="px-1">{title}</span>}
      </Button>
    </TooltipWrapper>
  );
};

export default ActionButton;
