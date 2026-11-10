import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type Props = {
  /** Hàm gọi API export; trả về tên file đã tải về. */
  onExport: () => Promise<string>;
  /** Nhãn hiển thị trên nút. */
  label?: string;
  /** Nội dung mô tả trong toast khi thành công. */
  successMessage?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg" | "icon";
  className?: string;
};

/**
 * Nút tải file Excel cho một phần analytics.
 * Dùng chung để mọi tab đều có nút "Export Excel" với hành vi giống nhau.
 */
export function ExportExcelButton({
  onExport,
  label = "Export Excel",
  successMessage = "Đã tải file Excel.",
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
          : "Không export được. Vui lòng thử lại.";
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
      {isExporting ? "Đang export..." : label}
    </Button>
  );
}
