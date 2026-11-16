import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  gitIntegrationApi,
  gitIntegrationErrorCode,
  gitIntegrationHttpStatus,
} from "@/api/features/git-integration.api";
import { usePermissions } from "@/hooks/usePermissions";
import { errorMessage } from "./git-integration.messages";
import { savePendingConnect } from "./git-integration.storage";

export const gitIntegrationKeys = {
  all: ["git-integration"] as const,
  installations: (role?: string | null) => ["git-integration", "installations", role ?? null] as const,
};

export function useGitInstallations() {
  const { activeRole } = usePermissions();
  return useQuery({
    queryKey: gitIntegrationKeys.installations(activeRole),
    queryFn: ({ signal }) => gitIntegrationApi.installations(signal),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

/**
 * Starts the GitHub App install. On success the browser leaves the app, so the
 * mutation stays "pending" on purpose: the button keeps its redirecting state
 * until navigation happens and cannot be clicked twice.
 */
export function useConnectGitHub() {
  return useMutation({
    mutationFn: async () => {
      const { installUrl } = await gitIntegrationApi.connect();
      savePendingConnect();
      window.location.assign(installUrl);
      await new Promise<never>(() => undefined);
    },
    onError: (error) => {
      const message = errorMessage(gitIntegrationErrorCode(error), gitIntegrationHttpStatus(error));
      toast.error(message.title, { description: message.description });
    },
  });
}
