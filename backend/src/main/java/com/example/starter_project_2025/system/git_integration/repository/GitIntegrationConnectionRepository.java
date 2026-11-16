package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitIntegrationConnection;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GitIntegrationConnectionRepository extends JpaRepository<GitIntegrationConnection, Long> {

    Optional<GitIntegrationConnection> findByProviderAndInstallationId(GitProvider provider, Long installationId);

    List<GitIntegrationConnection> findByProjectIdAndProviderAndIsActiveTrueOrderByConnectedAtDesc(
            Long projectId, GitProvider provider);
}
