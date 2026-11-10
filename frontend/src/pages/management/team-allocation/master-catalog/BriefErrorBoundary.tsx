import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Keeps a rendering failure inside the brief popup. Without it, an unexpected brief shape unmounts the whole app
 * (blank page) because nothing above the page catches render errors.
 */
export class BriefErrorBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unable to render the master brief", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="p-6">
      <div role="alert" className="grid gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        <p>Không hiển thị được nội dung đề bài. Hãy tải lại; nếu vẫn lỗi, kiểm tra backend đã được cập nhật và khởi động lại.</p>
        <Button className="w-fit" variant="outline" size="sm" onClick={() => {
          this.setState({ failed: false });
          this.props.onRetry();
        }}>Tải lại đề bài</Button>
      </div>
    </div>;
  }
}
