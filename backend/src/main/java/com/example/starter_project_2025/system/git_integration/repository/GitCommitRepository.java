package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface GitCommitRepository extends JpaRepository<GitCommit, Long>, JpaSpecificationExecutor<GitCommit> {

    /** SHAs among {@code shas} already stored for the repository connection. */
    @Query("select c.sha from GitCommit c where c.repositoryId = :repositoryId and c.sha in :shas")
    List<String> findExistingShas(@Param("repositoryId") Long repositoryId, @Param("shas") Collection<String> shas);

    long countByRepositoryId(Long repositoryId);

    Optional<GitCommit> findFirstByRepositoryIdOrderByCommittedAtDescIdDesc(Long repositoryId);
}
