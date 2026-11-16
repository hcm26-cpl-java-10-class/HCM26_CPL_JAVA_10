package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * The one place that changes an existing repository connection: ACTIVE →
 * UNAVAILABLE (which frees the master project, GI-04) and snapshot refreshes.
 * Joins the caller's transaction when there is one.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GitRepositoryConnectionWriter {

    private final GitRepositoryRepository connections;

    /** Returns true when the connection was ACTIVE and is now UNAVAILABLE. */
    @Transactional
    public boolean markUnavailable(Long repositoryId, String reason) {
        return connections.findById(repositoryId)
                .filter(row -> row.getStatus() == GitRepositoryStatus.ACTIVE)
                .map(row -> {
                    row.setStatus(GitRepositoryStatus.UNAVAILABLE);
                    log.info("Repository connection unavailable: repositoryId={}, externalId={}, projectId={}, reason={}",
                            row.getId(), row.getExternalId(), row.getProjectId(), reason);
                    return true;
                })
                .orElse(false);
    }

    /** SY-03 {@code installation.deleted}: every ACTIVE connection reached through the installation. */
    @Transactional
    public int markUnavailableByInstallation(Long installationRowId, String reason) {
        List<GitRepository> active = connections.findByInstallationRefAndStatus(installationRowId, GitRepositoryStatus.ACTIVE);
        active.forEach(row -> markUnavailable(row.getId(), reason));
        return active.size();
    }

    /** SY-03 {@code installation_repositories.removed}: the connection of one repository through that installation. */
    @Transactional
    public boolean markUnavailable(Long installationRowId, Long externalId, String reason) {
        return connections.findFirstByProviderAndExternalIdAndStatus(GitProvider.GITHUB, externalId, GitRepositoryStatus.ACTIVE)
                .filter(row -> row.getInstallationRef().equals(installationRowId))
                .map(row -> markUnavailable(row.getId(), reason))
                .orElse(false);
    }

    /** SY-03 {@code repository.renamed/transferred/privatized/publicized}: keeps the stored snapshot current. */
    @Transactional
    public Optional<GitRepository> refreshSnapshot(Long repositoryId, String ownerLogin, String name, String fullName,
                                                   String htmlUrl, String visibility, String defaultBranch) {
        return connections.findById(repositoryId)
                .filter(row -> row.getStatus() == GitRepositoryStatus.ACTIVE)
                .map(row -> {
                    if (ownerLogin != null) row.setOwnerLogin(ownerLogin);
                    if (name != null) row.setName(name);
                    if (fullName != null) row.setFullName(fullName);
                    if (htmlUrl != null) row.setHtmlUrl(htmlUrl);
                    if (visibility != null) row.setVisibility(visibility);
                    if (defaultBranch != null) row.setDefaultBranch(defaultBranch);
                    return row;
                });
    }
}
