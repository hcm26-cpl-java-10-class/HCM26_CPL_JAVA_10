package com.example.starter_project_2025.system.project.developmentinsights.service;

import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import java.util.List;
import java.util.Map;
import java.util.Set;

public record GitActivityScope(Workspace workspace, Long rootProjectId,
                               Set<Long> projectIds, boolean rootScope,
                               Set<Long> contributorIds,
                               Map<Long, Set<Long>> contributorsByProject,
                               boolean canReadTasks,
                               List<MemberIdentity> members) {
    public GitActivityScope(Workspace workspace, Long rootProjectId, Set<Long> projectIds,
                            boolean rootScope, Set<Long> contributorIds,
                            Map<Long, Set<Long>> contributorsByProject, boolean canReadTasks) {
        this(workspace, rootProjectId, projectIds, rootScope, contributorIds,
                contributorsByProject, canReadTasks, List.of());
    }

    public record MemberIdentity(Long userId, String name, String login, Set<Long> projectIds) { }

    public List<Long> projectList() {
        return projectIds.isEmpty() ? List.of(-1L) : projectIds.stream().sorted().toList();
    }

    public List<Long> contributorList() {
        return contributorIds.isEmpty() ? List.of(-1L) : contributorIds.stream().sorted().toList();
    }

    public List<Long> contributorsFor(Long projectId) {
        Set<Long> ids = contributorsByProject.getOrDefault(projectId, Set.of());
        return ids.isEmpty() ? List.of(-1L) : ids.stream().sorted().toList();
    }

    public List<MemberIdentity> membersFor(Long projectId) {
        if (projectId == null || (rootScope && java.util.Objects.equals(rootProjectId, projectId))) return members;
        return members.stream().filter(member -> member.projectIds().contains(projectId)).toList();
    }
}
