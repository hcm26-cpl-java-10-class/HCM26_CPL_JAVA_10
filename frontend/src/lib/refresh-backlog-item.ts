import type { QueryClient } from "@tanstack/react-query";
import type { SprintBacklogDTO } from "@/types";
import type { TeamBacklogBoard } from "@/api/features/team-backlog.api";

export async function refreshBacklogItem(queryClient: QueryClient, saved: SprintBacklogDTO) {
  if (saved.id != null) {
    queryClient.setQueryData(["sprint-backlog", "detail", saved.id], saved);
    queryClient.setQueriesData<TeamBacklogBoard>({ queryKey: ["team-backlog-board"] }, board => {
      if (!board) return board;
      return {
        ...board,
        items: board.items.map(item => item.id !== saved.id ? item : {
          ...item,
          ...saved,
          assigneeDisplayName: saved.assigneeProjectMemberId == null ? null
            : board.members.find(member => member.projectMemberId === saved.assigneeProjectMemberId)?.displayName
              || saved.assigneeDisplayName
              || (item.assigneeProjectMemberId === saved.assigneeProjectMemberId ? item.assigneeDisplayName : null),
        }),
      };
    });
  }
  await Promise.all([
    ["team-backlog-board"],
    ["sprint-backlogs", "backlog-page"],
    ["sprint-backlog-audit"],
  ].map(queryKey => queryClient.invalidateQueries({ queryKey })));
}
