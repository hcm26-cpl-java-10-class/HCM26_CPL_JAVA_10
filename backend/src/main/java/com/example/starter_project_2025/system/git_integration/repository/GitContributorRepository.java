package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitContributor;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GitContributorRepository extends JpaRepository<GitContributor, Long> {

    List<GitContributor> findByMasterProject_IdOrderByIdAsc(Long masterProjectId);

    Optional<GitContributor> findByMasterProject_IdAndIdentityKey(Long masterProjectId, String identityKey);

    Optional<GitContributor> findByIdAndMasterProject_Id(Long id, Long masterProjectId);

    /** Serializes mapping changes of one contributor. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from GitContributor c where c.masterProject.id = :masterId and c.identityKey = :identityKey")
    Optional<GitContributor> lockByIdentity(@Param("masterId") Long masterId, @Param("identityKey") String identityKey);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from GitContributor c where c.id = :id and c.masterProject.id = :masterId")
    Optional<GitContributor> lockById(@Param("id") Long id, @Param("masterId") Long masterId);

    /** The GitHub contributor(s) a member is mapped to in a master project. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select c from GitContributor c
             where c.masterProject.id = :masterId and c.user.id = :userId and c.externalUserId is not null""")
    List<GitContributor> lockGitHubMappings(@Param("masterId") Long masterId, @Param("userId") Long userId);

    boolean existsByMasterProject_IdAndUser_IdAndExternalUserIdIsNotNull(Long masterProjectId, Long userId);

    /** GI-06: whether a GitHub account still counts for a user in any master project. */
    boolean existsByUser_IdAndExternalUserId(Long userId, Long externalUserId);
}
