package com.example.starter_project_2025.system.project.developmentinsights.service;

import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitContributorRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.resources.TeamSubprojectAssignmentRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceContextService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceProjectScope;
import com.example.starter_project_2025.system.rbac.user.User;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Resolves the authorized root and module set from the existing Workspace assignment. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GitActivityScopeService {
    private static final String TASK_READ = "SPRINT_BACKLOG_READ";

    private final WorkspaceAccessService access;
    private final WorkspaceContextService contexts;
    private final WorkspaceProjectScope workspaceProjects;
    private final ProjectRepository projects;
    private final ProjectTeamRepository teams;
    private final TeamSubprojectAssignmentRepository assignments;
    private final ProjectMemberRepository members;
    private final GitContributorRepository contributors;

    public GitActivityScope require(Long workspaceId) {
        User actor = access.requireUser(false);
        Workspace workspace = contexts.require(actor, workspaceId);
        List<Project> scopedProjects = workspaceProjects.projects(workspace);
        if (scopedProjects.isEmpty()) throw new AccessDeniedException("This Workspace has no assigned Project scope");

        Long tenantId = workspace.getTenant().getId();
        Set<Long> selectedProjectIds = new LinkedHashSet<>();
        Map<Long, Project> rootsById = new HashMap<>();
        for (Project project : scopedProjects) {
            requireActiveProject(project, tenantId);
            selectedProjectIds.add(project.getId());
            Project root = rootOf(project, tenantId);
            rootsById.put(root.getId(), root);
        }
        if (rootsById.size() != 1) throw new AccessDeniedException("This Workspace spans more than one Git root");

        Project root = rootsById.values().iterator().next();
        Long rootId = root.getId();
        Set<Long> clusterProjectIds = descendantCluster(root, tenantId);
        boolean rootScope = selectedProjectIds.contains(rootId);
        Set<Long> allowedProjectIds = rootScope ? clusterProjectIds : selectedProjectIds;

        Map<Long, Set<Long>> userProjects = new HashMap<>();
        Map<Long, User> usersById = new HashMap<>();
        for (Long projectId : clusterProjectIds) {
            Set<Long> teamIds = new LinkedHashSet<>();
            teams.findAllByProject_IdInOrderByIdDesc(List.of(projectId)).forEach(team -> teamIds.add(team.getId()));
            assignments.findAllByProject_IdAndIsActiveTrueOrderByIdAsc(projectId)
                    .forEach(assignment -> teamIds.add(assignment.getTeam().getId()));
            for (Long teamId : teamIds) {
                for (ProjectMember member : members.findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(
                        teamId, ClassMemberStatus.ACTIVE)) {
                    if (!Boolean.TRUE.equals(member.getIsActive())
                            || !Boolean.TRUE.equals(member.getClassMember().getIsActive())) continue;
                    User user = member.getClassMember().getUser();
                    if (user != null && user.getTenant() != null
                            && Objects.equals(user.getTenant().getId(), tenantId)) {
                        userProjects.computeIfAbsent(user.getId(), ignored -> new LinkedHashSet<>()).add(projectId);
                        usersById.putIfAbsent(user.getId(), user);
                    }
                }
            }
        }

        Map<Long, Set<Long>> contributorsByProject = new HashMap<>();
        for (Long projectId : clusterProjectIds) {
            Set<Long> uniquelyAssignedUsers = new HashSet<>();
            userProjects.forEach((userId, memberships) -> {
                if (memberships.size() == 1 && memberships.contains(projectId)) uniquelyAssignedUsers.add(userId);
            });
            if (!uniquelyAssignedUsers.isEmpty()) {
                contributors.findAllByRootProject_IdAndUser_IdIn(rootId, uniquelyAssignedUsers)
                        .forEach(contributor -> contributorsByProject
                                .computeIfAbsent(projectId, ignored -> new LinkedHashSet<>()).add(contributor.getId()));
            }
        }

        Set<Long> eligibleRootUsers = new HashSet<>();
        userProjects.forEach((userId, memberships) -> {
            if (rootScope && !memberships.isEmpty()) eligibleRootUsers.add(userId);
            else if (memberships.size() == 1 && allowedProjectIds.contains(memberships.iterator().next())) {
                eligibleRootUsers.add(userId);
            }
        });
        Set<Long> contributorIds = new LinkedHashSet<>();
        if (!eligibleRootUsers.isEmpty()) {
            contributors.findAllByRootProject_IdAndUser_IdIn(rootId, eligibleRootUsers)
                    .forEach(contributor -> contributorIds.add(contributor.getId()));
        }

        List<GitActivityScope.MemberIdentity> memberIdentities = userProjects.entrySet().stream()
                .filter(entry -> entry.getValue().stream().anyMatch(allowedProjectIds::contains))
                .map(entry -> {
                    User user = usersById.get(entry.getKey());
                    return new GitActivityScope.MemberIdentity(entry.getKey(), user.getFullName(), user.getUsername(),
                            Set.copyOf(entry.getValue()));
                })
                .sorted(java.util.Comparator.comparing(GitActivityScope.MemberIdentity::name,
                        java.util.Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();

        return new GitActivityScope(workspace, rootId, Set.copyOf(allowedProjectIds), rootScope,
                Set.copyOf(contributorIds), immutableMap(contributorsByProject), access.permitted(actor, TASK_READ),
                memberIdentities);
    }

    private Project rootOf(Project project, Long tenantId) {
        Set<Long> seen = new HashSet<>();
        Project current = project;
        while (current != null) {
            requireActiveProject(current, tenantId);
            if (!seen.add(current.getId())) throw new AccessDeniedException("Project hierarchy contains a cycle");
            Project parent = current.getParentProject();
            if (parent == null) return current;
            current = parent;
        }
        throw new AccessDeniedException("Project hierarchy has no root");
    }

    private Set<Long> descendantCluster(Project root, Long tenantId) {
        Set<Long> visited = new LinkedHashSet<>();
        ArrayDeque<Project> pending = new ArrayDeque<>();
        pending.add(root);
        while (!pending.isEmpty()) {
            Project parent = pending.removeFirst();
            if (!visited.add(parent.getId())) continue;
            for (Project child : projects.findAllByParentProject_IdAndIsActiveTrueOrderByIdAsc(parent.getId())) {
                requireActiveProject(child, tenantId);
                if (!visited.contains(child.getId())) pending.addLast(child);
            }
        }
        return visited;
    }

    private void requireActiveProject(Project project, Long tenantId) {
        if (project == null || project.getId() == null || !Boolean.TRUE.equals(project.getIsActive())
                || !Objects.equals(project.getTenantId(), tenantId)) {
            throw new AccessDeniedException("Project scope is inactive or outside the current tenant");
        }
    }

    private Map<Long, Set<Long>> immutableMap(Map<Long, Set<Long>> source) {
        Map<Long, Set<Long>> result = new HashMap<>();
        source.forEach((key, value) -> result.put(key, Set.copyOf(value)));
        return Map.copyOf(result);
    }
}
