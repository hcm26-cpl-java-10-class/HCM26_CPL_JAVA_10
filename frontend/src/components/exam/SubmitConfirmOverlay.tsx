// In-page confirmation (instead of window.confirm): a native browser dialog makes the browser leave fullscreen.
import { Button } from '@/components/ui/button';

export function SubmitConfirmOverlay({
    title = 'Submit exam?',
    message,
    confirmLabel = 'Submit',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
}: {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <div
            role="alertdialog"
            aria-modal="true"
            className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 p-4"
        >
            <div className="w-full max-w-md space-y-4 rounded-xl border bg-card p-6 shadow-lg">
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="whitespace-pre-line text-sm text-muted-foreground">{message}</p>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={onCancel}>{cancelLabel}</Button>
                    <Button autoFocus onClick={onConfirm}>{confirmLabel}</Button>
                </div>
            </div>
        </div>
    );
}
