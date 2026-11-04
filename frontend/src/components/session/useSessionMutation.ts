import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { SessionDTO } from "@/types";
import { describeApiError } from "@/utils/api-error.utils";
import { SESSION_QUERY_KEY } from "@/utils/session.utils";

interface UseSessionMutationOptions<TVariables> {
    mutationFn: (variables: TVariables) => Promise<SessionDTO>;
    successMessage: string | ((session: SessionDTO) => string);
    onSuccess?: (session: SessionDTO) => void;
}

/**
 * Wraps a session write so every dialog behaves the same: the session caches (lists, class calendars,
 * details) are refreshed after success, and also after a 404/409 because the row then changed under us.
 */
export function useSessionMutation<TVariables>({ mutationFn, successMessage, onSuccess }: UseSessionMutationOptions<TVariables>) {
    const queryClient = useQueryClient();

    return useMutation<SessionDTO, unknown, TVariables>({
        mutationFn,
        onSuccess: async (session) => {
            await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
            toast.success(typeof successMessage === "function" ? successMessage(session) : successMessage);
            onSuccess?.(session);
        },
        onError: (error) => {
            const { kind } = describeApiError(error);
            if (kind === "notFound" || kind === "conflict") {
                void queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
            }
        },
    });
}
