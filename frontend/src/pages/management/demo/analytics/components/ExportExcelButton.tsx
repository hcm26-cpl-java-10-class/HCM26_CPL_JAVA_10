import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  /** API call that performs the export; returns the downloaded file name. */
  onExport: () => Promise<string>;
  /** Label displayed on the button. */
  label?: string;
  /** Toast message shown on success. */
  successMessage?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
};

/**
 * Excel download button for a single analytics section.
 * Shared so every tab gets the same "Export Excel" behaviour.
 */
export function ExportExcelButton({
  onExport,
  label = "Export Excel",
  successMessage = "Excel file downloaded.",
  variant = "outline",
  size = "sm",
  className,
}: Props) {
  const [isExporting, setIsExporting] = useState(false);

  const handleClick = async () => {
    if (isExporting) return;

    setIsExporting(true);
    try {
      const filename = await onExport();
      toast.success(successMessage, { description: filename });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Export failed. Please try again.";
      toast.error(message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isExporting}
    >
      {isExporting ? (
        <Loader2 className="animate-spin" />
      ) : (
        <Download />
      )}
      {isExporting ? "Exporting..." : label}
    </Button>
  );
}