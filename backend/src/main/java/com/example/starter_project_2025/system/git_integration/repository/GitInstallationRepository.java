package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GitInstallationRepository extends JpaRepository<GitInstallation, Long> {

    Optional<GitInstallation> findByProviderAndInstallationId(GitProvider provider, Long installationId);

    List<GitInstallation> findByTenantIdAndProviderAndIsActiveTrueOrderByConnectedAtDesc(Long tenantId, GitProvider provider);
}
