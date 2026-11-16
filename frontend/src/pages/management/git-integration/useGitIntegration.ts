import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  gitIntegrationApi,
  gitIntegrationErrorCode,
  gitIntegrationHttpStatus,
} from "@/api/features/git-integration.api";
import { usePermissions } from "@/hooks/usePermissions";
import type { GitRepositoryQuery } from "@/types/features/git-integration";
import { errorMessage } from "./git-integration.messages";
import { savePendingConnect } from "./git-integration.storage";

export const gitIntegrationKeys = {
  all: ["git-integration"] as const,
  installations: (role?: string | null) => ["git-integration", "installations", role ?? null] as const,
  repositories: (installationId: number, query: Omit<GitRepositoryQuery, "refresh">) =>
    ["git-integration", "repositories", installationId, query.q ?? "", query.filter ?? "all",
      query.page ?? 0, query.size ?? 20, query.projectId ?? null] as const,
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

/**
 * US-GI-03: one page of an installation's repositories. Keeps the previous page on screen
 * while the next one loads; `refresh()` asks the server to refetch from GitHub (bypassing its cache).
 */
export function useInstallationRepositories(installationId: number | undefined, query: Omit<GitRepositoryQuery, "refresh">) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const key = gitIntegrationKeys.repositories(installationId ?? 0, query);
  const result = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => gitIntegrationApi.repositories(installationId!, query, signal),
    enabled: installationId !== undefined,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 30_000,
  });

  const refresh = useCallback(async () => {
    if (installationId === undefined) return;
    setRefreshing(true);
    try {
      const fresh = await gitIntegrationApi.repositories(installationId, { ...query, refresh: true });
      queryClient.setQueryData(key, fresh);
      // Other pages/searches of this installation now come from the refreshed server cache.
      void queryClient.invalidateQueries({ queryKey: ["git-integration", "repositories", installationId], refetchType: "none" });
    } catch {
      await result.refetch();
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [installationId, queryClient, JSON.stringify(key)]);

  return { ...result, refresh, refreshing };
}
