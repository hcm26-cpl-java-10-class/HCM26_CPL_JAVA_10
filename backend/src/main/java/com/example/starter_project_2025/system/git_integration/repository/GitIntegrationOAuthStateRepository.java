package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitIntegrationOAuthState;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Optional;

public interface GitIntegrationOAuthStateRepository extends JpaRepository<GitIntegrationOAuthState, Long> {

    /** Row lock so two concurrent callbacks cannot both consume the same state. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from GitIntegrationOAuthState s where s.stateHash = :hash")
    Optional<GitIntegrationOAuthState> findByStateHashForUpdate(@Param("hash") String stateHash);

    @Modifying
    @Query("delete from GitIntegrationOAuthState s where s.expiresAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") LocalDateTime cutoff);
}
