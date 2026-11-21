package com.example.starter_project_2025.system.git_integration.contributor;

import com.example.starter_project_2025.system.git_integration.service.GitIntegrationAccessService;
import com.example.starter_project_2025.system.git_integration.service.GitProjectResolver;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryLinkPolicy;
import com.example.starter_project_2025.system.git_integration.tasklink.ProjectScopeResolver;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;

/**
 * GI-06: loads the master project of a request and decides who may do what in it.
 * <ul>
 *     <li>View the GitHub accounts: anyone who may view the project's repository.</li>
 *     <li>Connect one's own account: members of the master or of a module (BR7).</li>
 *     <li>Manage other people's mappings (AC10, AC11): a PM of the scope, an assigned mentor,
 *     or {@code GIT_INTEGRATION_MANAGE}.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
class GitAccountContextLoader {

    private final GitProjectResolver projects;
    private final ProjectScopeResolver scopes;
    private final GitProjectMembership membership;
    private final GitRepositoryLinkPolicy linkPolicy;
    private final GitIntegrationAccessService access;

    /** 404 when the project is missing, inactive or of another tenant. */
    @Transactional(readOnly = true)
    public MasterContext load(User user, Long projectId) {
        Project project = projects.require(user, projectId);
        Project master = projects.masterOf(project);
        Set<Long> scope = scopes.scope(master.getId());
        List<GitProjectMembership.Member> members = membership.members(scope);
        boolean pm = members.stream().anyMatch(member -> member.userId().equals(user.getId()) && member.isPm());
        boolean canManage = access.canManage(user) || pm || membership.isMentor(user.getId(), scope);
        return new MasterContext(user.getTenant().getId(), master.getId(), GitProjectResolver.summary(master), scope,
                members, linkPolicy.canView(user, project), canManage);
    }
}
