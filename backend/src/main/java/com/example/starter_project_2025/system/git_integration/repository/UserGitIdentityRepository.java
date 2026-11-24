package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.UserGitIdentity;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserGitIdentityRepository extends JpaRepository<UserGitIdentity, Long> {

    Optional<UserGitIdentity> findByUser_IdAndProvider(Long userId, GitProvider provider);

    Optional<UserGitIdentity> findByProviderAndExternalUserId(GitProvider provider, Long externalUserId);
}
