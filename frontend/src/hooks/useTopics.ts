import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { topicApi, type TopicPageParams } from "@/api/features/topic.api";
import type { TopicItem, TopicSyllabusDto } from "@/types/features/content";

export const topicKeys = {
  all: ["topics"] as const,
  lists: () => [...topicKeys.all, "list"] as const,
  list: (params: TopicPageParams) => [...topicKeys.lists(), params] as const,
  active: () => [...topicKeys.all, "active"] as const,
  detail: (id: number | string) => [...topicKeys.all, "detail", String(id)] as const,
  syllabus: (id: number | string) => [...topicKeys.all, "syllabus", String(id)] as const,
};

export function useTopicList(params: TopicPageParams) {
  return useQuery({
    queryKey: topicKeys.list(params),
    queryFn: () => topicApi.getPage(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useActiveTopics(enabled = true) {
  return useQuery({
    queryKey: topicKeys.active(),
    queryFn: topicApi.getActive,
    enabled,
    staleTime: 60_000,
  });
}

export function useTopicSyllabus(id?: number | string | null, enabled = true) {
  return useQuery({
    queryKey: topicKeys.syllabus(id ?? ""),
    queryFn: () => topicApi.getSyllabus(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 30_000,
  });
}

export function useTopicMutations() {
  const queryClient = useQueryClient();

  const invalidateTopics = () =>
    queryClient.invalidateQueries({ queryKey: topicKeys.all });

  const createTopic = useMutation({
    mutationFn: (payload: Partial<TopicItem>) => topicApi.create(payload),
    onSuccess: invalidateTopics,
  });

  const updateTopic = useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: Partial<TopicItem> }) =>
      topicApi.update(id, data),
    onSuccess: invalidateTopics,
  });

  const toggleTopicStatus = useMutation({
    mutationFn: ({ id, active }: { id: number | string; active: boolean }) =>
      topicApi.changeStatus(id, active),
    onSuccess: invalidateTopics,
  });

  const deleteTopic = useMutation({
    mutationFn: async (id: number | string) => {
      const referenced = await topicApi.isReferenced(id);
      if (referenced) {
        throw new Error("TOPIC_REFERENCED");
      }
      await topicApi.delete(id);
    },
    onSuccess: invalidateTopics,
  });

  const commitTopicImport = useMutation({
    mutationFn: (items: Partial<TopicItem>[]) => topicApi.commitImport(items),
    onSuccess: invalidateTopics,
  });

  const saveTopicSyllabus = useMutation({
    mutationFn: ({ id, payload }: { id: number | string; payload: TopicSyllabusDto }) =>
      topicApi.saveSyllabus(id, payload),
    onSuccess: (_, variables) =>
      queryClient.invalidateQueries({ queryKey: topicKeys.syllabus(variables.id) }),
  });

  const resetTopicSyllabus = useMutation({
    mutationFn: (id: number | string) => topicApi.resetSyllabus(id),
    onSuccess: (_, id) =>
      queryClient.invalidateQueries({ queryKey: topicKeys.syllabus(id) }),
  });

  return {
    invalidateTopics,
    createTopic,
    updateTopic,
    toggleTopicStatus,
    deleteTopic,
    commitTopicImport,
    saveTopicSyllabus,
    resetTopicSyllabus,
  };
}

