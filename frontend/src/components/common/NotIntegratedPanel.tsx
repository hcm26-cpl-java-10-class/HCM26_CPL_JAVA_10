import { PlugZap, type LucideIcon } from "lucide-react";

interface NotIntegratedPanelProps {
    title: string;
    description: string;
    /** The contract / owner this feature is waiting for. */
    needs: string;
    icon?: LucideIcon;
}

/**
 * Shown where a screen depends on data the backend does not expose yet.
 * It says so plainly instead of drawing a table of made-up rows.
 */
export function NotIntegratedPanel({ title, description, needs, icon: Icon = PlugZap }: NotIntegratedPanelProps) {
    return (
        <div
            role="status"
            className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-muted/20 px-6 py-12 text-center"
        >
            <Icon className="size-8 text-muted-foreground" aria-hidden />
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="max-w-xl text-sm text-muted-foreground">{description}</p>
            <p className="max-w-xl text-xs text-muted-foreground">
                <span className="font-medium">Waiting for:</span> {needs}
            </p>
        </div>
    );
}
