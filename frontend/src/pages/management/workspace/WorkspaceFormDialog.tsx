import type { FormEventHandler, ReactNode } from "react";
import { Info, Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function WorkspaceFormDialog({ open, onOpenChange, title, description, icon: Icon, badge,
  busy, submitDisabled, submitLabel, submitIcon: SubmitIcon, onSubmit, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  icon: LucideIcon;
  badge?: ReactNode;
  busy: boolean;
  submitDisabled?: boolean;
  submitLabel: string;
  submitIcon: LucideIcon;
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
}) {
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}>
    <DialogContent showCloseButton={!busy} overlayClassName="bg-slate-950/45 supports-backdrop-filter:backdrop-blur-sm"
      className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl sm:max-w-2xl [&>[data-slot=dialog-close]]:right-3 [&>[data-slot=dialog-close]]:top-4">
      <DialogHeader className="shrink-0 border-b bg-muted/20 px-5 py-4 pr-12 sm:px-6 sm:pr-14">
        <div className="flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 text-blue-600 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400"><Icon className="size-5" /></span>
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle className="text-base font-semibold leading-6 sm:text-lg">{title}</DialogTitle>
              {badge}
            </div>
            <DialogDescription className="text-xs leading-5 sm:text-sm">{description}</DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <form noValidate onSubmit={onSubmit} aria-busy={busy} className="flex min-h-0 flex-col">
        <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-4 [scrollbar-width:thin] sm:px-6">{children}</div>
        <DialogFooter className="m-0 shrink-0 flex-row flex-wrap items-center justify-end gap-3 rounded-none px-5 py-4 sm:justify-between sm:px-6">
          <span className="mr-auto hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex"><Info className="size-3.5" />{busy ? "Đang lưu thay đổi…" : <>Nhấn <kbd className="rounded border bg-background px-1.5 py-0.5 text-[10px]">Esc</kbd> để hủy</>}</span>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button type="button" variant="outline" className="h-10 min-w-0 flex-1 rounded-xl text-xs sm:flex-none sm:text-sm" disabled={busy} onClick={() => onOpenChange(false)}>Hủy bỏ</Button>
            <Button type="submit" className="h-10 min-w-0 flex-1 rounded-xl border border-transparent bg-black text-xs text-white hover:bg-black/85 dark:border-slate-600 sm:flex-none sm:text-sm" disabled={busy || submitDisabled}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <SubmitIcon className="size-4" />}{busy ? "Đang lưu…" : submitLabel}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
