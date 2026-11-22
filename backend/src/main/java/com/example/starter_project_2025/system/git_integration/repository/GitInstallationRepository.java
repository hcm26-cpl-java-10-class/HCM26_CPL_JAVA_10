package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GitInstallationRepository extends JpaRepository<GitInstallation, Long> {

    Optional<GitInstallation> findByProviderAndInstallationId(GitProvider provider, Long installationId);

    List<GitInstallation> findByTenantIdAndProviderAndIsActiveTrueOrderByConnectedAtDesc(Long tenantId, GitProvider provider);

    /** GI-06: the latest installation a user connected; its GitHub user was verified with GET /user. */
    Optional<GitInstallation> findFirstByConnectedByUserIdAndTenantIdAndProviderAndGithubUserIdIsNotNullOrderByConnectedAtDesc(
            Long connectedByUserId, Long tenantId, GitProvider provider);

    /** GI-07: serializes a disconnection with another one and with the "deleted" webhook. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select i from GitInstallation i where i.id = :id")
    Optional<GitInstallation> lockById(@Param("id") Long id);
}
