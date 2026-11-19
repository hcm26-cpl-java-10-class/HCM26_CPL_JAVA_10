package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface GitCommitRepository extends JpaRepository<GitCommit, Long>, JpaSpecificationExecutor<GitCommit> {

    /** SHAs among {@code shas} already stored for the repository connection. */
    @Query("select c.sha from GitCommit c where c.repositoryId = :repositoryId and c.sha in :shas")
    List<String> findExistingShas(@Param("repositoryId") Long repositoryId, @Param("shas") Collection<String> shas);

    long countByRepositoryId(Long repositoryId);

    Optional<GitCommit> findFirstByRepositoryIdAndSha(Long repositoryId, String sha);

    Optional<GitCommit> findFirstByRepositoryIdOrderByCommittedAtDescIdDesc(Long repositoryId);

    /** WS-GH-02: the columns insights need of one commit. */
    interface CommitStatRow {
        LocalDateTime getCommittedAt();
        String getAuthorLogin();
        String getAuthorName();
        String getFirstSeenRef();
    }

    /** WS-GH-02: commits of {@code [from, to)}, newest first (the page caps how many are read). */
    @Query("""
            select c.committedAt as committedAt, c.authorLogin as authorLogin, c.authorName as authorName,
                   c.firstSeenRef as firstSeenRef
              from GitCommit c
             where c.repositoryId = :repositoryId and c.committedAt >= :from and c.committedAt < :to
             order by c.committedAt desc, c.id desc""")
    List<CommitStatRow> statsBetween(@Param("repositoryId") Long repositoryId, @Param("from") LocalDateTime from,
                                     @Param("to") LocalDateTime to, Pageable page);

    /** WS-GH-02: one branch (full ref) of a repository with its commit count and latest commit. */
    interface BranchRow {
        String getRef();
        Long getCommits();
        LocalDateTime getLastCommitAt();
    }

    /**
     * WS-GH-02: branches the commits were first pushed to, latest activity first.
     * {@code pattern} is a lower-case LIKE on the full ref (for example {@code refs/heads/%feat%}).
     */
    @Query("""
            select c.firstSeenRef as ref, count(c) as commits, max(c.committedAt) as lastCommitAt
              from GitCommit c
             where c.repositoryId = :repositoryId and c.firstSeenRef like 'refs/heads/%'
               and lower(c.firstSeenRef) like :pattern
             group by c.firstSeenRef
             order by max(c.committedAt) desc, c.firstSeenRef""")
    List<BranchRow> branches(@Param("repositoryId") Long repositoryId, @Param("pattern") String pattern, Pageable page);
}
