package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.dto.LinkRepositoryRequest;
import com.example.starter_project_2025.system.git_integration.dto.ProjectRepositoryView;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiClient;
import com.example.starter_project_2025.system.git_integration.github.GitHubApiException;
import com.example.starter_project_2025.system.git_integration.github.InstallationTokenProvider;
import com.example.starter_project_2025.system.git_integration.github.dto.GitHubRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

/**
 * GI-04: link a GitHub repository to a master project.
 * <p>
 * No transaction is held while GitHub is called: {@link GitRepositoryLinkWriter#check}
 * validates first, GitHub confirms the installation can still access the
 * repository (AC04, never the 5-minute cache), then
 * {@link GitRepositoryLinkWriter#create} writes under a lock on the master.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GitRepositoryLinkService {

    private final GitHubAppProperties properties;
    private final GitIntegrationAccessService access;
    private final GitRepositoryLinkWriter writer;
    private final ProjectRepositoryQueryService queries;
    private final GitHubApiClient github;
    private final InstallationTokenProvider tokens;
    private final GitHubFailures failures;

    /** {@code created = false} when the repository was already linked to this project (idempotent retry). */
    public record LinkResult(ProjectRepositoryView view, boolean created) {
    }

    public LinkResult link(Long projectId, LinkRepositoryRequest request) {
        if (!properties.isEnabled()) {
            throw GitIntegrationException.disabled();
        }
        User user = access.requireUser();
        GitRepositoryLinkWriter.Plan plan = writer.check(user, projectId, request);
        if (plan.existingConnectionId() != null) {
            return new LinkResult(queries.view(user, projectId), false);
        }

        GitHubRepository repository = fetchAccessibleRepository(plan);

        boolean created;
        try {
            created = writer.create(user, plan, repository).isPresent();
        } catch (DataIntegrityViolationException race) {
            // A concurrent link won the unique constraint: report it as AC02 / AC03.
            GitRepositoryLinkWriter.Plan again = writer.check(user, projectId, request);
            if (again.existingConnectionId() == null) {
                throw race;
            }
            created = false;
        }
        if (created) {
            log.info("Repository linked: tenantId={}, projectId={}, externalId={}, fullName={}, actorUserId={}",
                    plan.tenantId(), plan.projectId(), repository.id(), repository.fullName(), user.getId());
        }
        return new LinkResult(queries.view(user, projectId), created);
    }

    private GitHubRepository fetchAccessibleRepository(GitRepositoryLinkWriter.Plan plan) {
        GitHubRepository repository;
        try {
            String token = tokens.token(plan.githubInstallationId());
            repository = github.getRepository(token, plan.externalId())
                    .orElseThrow(GitIntegrationException::repositoryNotAccessible);
        } catch (GitHubApiException e) {
            throw failures.toBusinessError(plan.installationRowId(), plan.githubInstallationId(), e, "link-repository");
        }
        if (Boolean.TRUE.equals(repository.archived()) || Boolean.TRUE.equals(repository.disabled())) {
            throw GitIntegrationException.repositoryArchived();
        }
        return repository;
    }
}
