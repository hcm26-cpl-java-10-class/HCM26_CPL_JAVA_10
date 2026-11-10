import { AlertCircle, Inbox } from "lucide-react";

type Props = {
  message: string;
  variant?: "empty" | "error";
};

/** Thông báo khi không có dữ liệu / gặp lỗi tải dữ liệu. */
export function AnalyticsEmptyState({ message, variant = "empty" }: Props) {
  const isError = variant === "error";

  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-center">
      {isError ? (
        <AlertCircle className="size-6 text-destructive" />
      ) : (
        <Inbox className="size-6 text-muted-foreground" />
      )}
      <p
        className={`text-sm ${isError ? "text-destructive" : "text-muted-foreground"}`}
        role={isError ? "alert" : undefined}
      >
        {message}
      </p>
    </div>
  );
}
