package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitPullRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GitPullRequestRepository extends JpaRepository<GitPullRequest, Long>, JpaSpecificationExecutor<GitPullRequest> {

    Optional<GitPullRequest> findByRepositoryIdAndNumber(Long repositoryId, Integer number);

    long countByRepositoryId(Long repositoryId);

    /** Rows of (state, count) for the repository connection. */
    @Query("select p.state, count(p) from GitPullRequest p where p.repositoryId = :repositoryId group by p.state")
    List<Object[]> countByState(@Param("repositoryId") Long repositoryId);
}
