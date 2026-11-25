package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.dto.GitLinkDetails;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitProjectLookupRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.EnumSet;
import java.util.Set;

/**
 * GI-04: project rules of Git Integration. A repository belongs to the master
 * project ({@code parent_project_id IS NULL}); modules use their master's.
 * Call inside a transaction: walking up the hierarchy loads lazy parents.
 */
@Component
@RequiredArgsConstructor
public class GitProjectResolver {

    /** A repository can be linked while the master project has not ended. */
    static final Set<ProjectStatus> LINKABLE_STATUSES = EnumSet.of(ProjectStatus.DRAFT, ProjectStatus.PLANNING, ProjectStatus.ACTIVE);
    private static final int MAX_DEPTH = 10;

    private final GitProjectLookupRepository projects;

    /** The project when it exists, is active and belongs to the user's tenant; 404 otherwise (no leak across tenants). */
    public Project require(User user, Long projectId) {
        return projects.findById(projectId)
                .filter(project -> user.getTenant().getId().equals(project.getTenantId()))
                .filter(project -> Boolean.TRUE.equals(project.getIsActive()))
                .orElseThrow(GitIntegrationException::projectNotFound);
    }

    public Project masterOf(Project project) {
        Project current = project;
        for (int depth = 0; current.getParentProject() != null; depth++) {
            if (depth >= MAX_DEPTH) {
                throw new IllegalStateException("Project hierarchy is deeper than " + MAX_DEPTH + " levels or cyclic");
            }
            current = current.getParentProject();
        }
        return current;
    }

    public boolean isMaster(Project project) {
        return project.getParentProject() == null;
    }

    public boolean isLinkable(Project master) {
        return Boolean.TRUE.equals(master.getIsActive()) && LINKABLE_STATUSES.contains(master.getStatus());
    }

    /** AC05 + project status: the project accepts a repository link. */
    public void requireLinkableMaster(Project project) {
        if (!isMaster(project)) {
            throw GitIntegrationException.projectNotMaster(summary(masterOf(project)));
        }
        if (!isLinkable(project)) {
            throw GitIntegrationException.projectNotLinkable(String.valueOf(project.getStatus()));
        }
    }

    public long moduleCount(Project master) {
        return projects.countModules(master.getId());
    }

    public static GitLinkDetails.ProjectSummary summary(Project project) {
        return new GitLinkDetails.ProjectSummary(project.getId(), project.getCode(), project.getName());
    }
}
