import { useCallback, useMemo, useState } from "react";
import type { SessionDTO } from "@/types";

/** The single dialog that is open at any time; the pages that list sessions share this one state shape. */
export type SessionAction =
    | { type: "create"; classId?: number }
    | { type: "edit"; session: SessionDTO }
    | { type: "reschedule"; session: SessionDTO }
    | { type: "duplicate"; session: SessionDTO }
    | { type: "complete"; session: SessionDTO }
    | { type: "cancel"; session: SessionDTO };

export interface SessionActionController {
    action: SessionAction | null;
    open: (action: SessionAction) => void;
    close: () => void;
}

export function useSessionActionController(): SessionActionController {
    const [action, setAction] = useState<SessionAction | null>(null);
    const close = useCallback(() => setAction(null), []);

    return useMemo(() => ({ action, open: setAction, close }), [action, close]);
}
