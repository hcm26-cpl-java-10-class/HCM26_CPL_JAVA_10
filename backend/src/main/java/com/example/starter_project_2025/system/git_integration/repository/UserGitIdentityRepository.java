package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.UserGitIdentity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserGitIdentityRepository extends JpaRepository<UserGitIdentity, Long> {

    Optional<UserGitIdentity> findByUserIdAndProvider(Long userId, GitProvider provider);

    Optional<UserGitIdentity> findByProviderAndExternalUserId(GitProvider provider, Long externalUserId);
}
