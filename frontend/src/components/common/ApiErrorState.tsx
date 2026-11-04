import { AlertTriangle, Lock, RefreshCw, SearchX, ServerCrash, WifiOff, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { describeApiError, type ApiErrorKind } from "@/utils/api-error.utils";

interface ApiErrorStateProps {
    error: unknown;
    /** Forces how the error is presented, e.g. "notFound" for an id that is malformed and was never sent to the API. */
    kind?: ApiErrorKind;
    /** What was being loaded ("class", "session", ...); used in the wording of "not found" errors. */
    resource?: string;
    onRetry?: () => void;
    backTo?: { to: string; label: string };
    className?: string;
}

interface Presentation {
    icon: LucideIcon;
    title: string;
    message?: string;
    retryable: boolean;
}

function present(kind: ApiErrorKind, resource: string): Presentation {
    switch (kind) {
        case "notFound":
            return {
                icon: SearchX,
                title: `${resource.charAt(0).toUpperCase()}${resource.slice(1)} not found`,
                message: `This ${resource} does not exist or has been removed. Check the link, or go back and pick another one.`,
                retryable: false,
            };
        case "forbidden":
            return { icon: Lock, title: "Access denied", retryable: false };
        case "unauthorized":
            return { icon: Lock, title: "Session expired", retryable: false };
        case "network":
            return { icon: WifiOff, title: "Cannot reach the server", retryable: true };
        case "upstream":
            return { icon: ServerCrash, title: "Master training system unavailable", retryable: true };
        case "server":
            return { icon: ServerCrash, title: "Server error", retryable: true };
        default:
            return { icon: AlertTriangle, title: "Something went wrong", retryable: true };
    }
}

/**
 * One place that tells 401 / 403 / 404 / 5xx / network failures apart for a page or a panel,
 * so an error is never mistaken for "no data" and an empty list is never shown as an error.
 */
export function ApiErrorState({ error, kind, resource = "item", onRetry, backTo, className }: ApiErrorStateProps) {
    const info = describeApiError(error);
    const effectiveKind = kind ?? info.kind;
    const presentation = present(effectiveKind, resource);
    const Icon = presentation.icon;

    return (
        <div role="alert" className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
            <Icon className="size-8 text-muted-foreground" aria-hidden />
            <h2 className="text-base font-semibold">{presentation.title}</h2>
            <p className="max-w-xl text-sm text-muted-foreground">{presentation.message ?? info.message}</p>
            {info.status && !kind ? <p className="text-xs text-muted-foreground">HTTP {info.status}</p> : null}
            <div className="flex flex-wrap items-center justify-center gap-2">
                {presentation.retryable && onRetry ? (
                    <Button variant="outline" onClick={onRetry}>
                        <RefreshCw /> Try again
                    </Button>
                ) : null}
                {effectiveKind === "unauthorized" ? (
                    <Button asChild>
                        <Link to="/login">Sign in</Link>
                    </Button>
                ) : null}
                {backTo ? (
                    <Button asChild variant="outline">
                        <Link to={backTo.to}>{backTo.label}</Link>
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
