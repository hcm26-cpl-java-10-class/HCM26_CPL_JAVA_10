package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GitCommitRepository extends JpaRepository<GitCommit, Long>, JpaSpecificationExecutor<GitCommit> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from GitCommit c where c.id = :id")
    Optional<GitCommit> lockById(@Param("id") Long id);
    List<GitCommit> findByRepository_IdOrderByIdAsc(Long repositoryId);

    @Query("""
            select c from GitCommit c join fetch c.repository r join fetch r.installation
             where c.parentCount is null and c.id > :afterId and r.status in ('ACTIVE', 'ERROR')
             order by c.id""")
    List<GitCommit> findMissingMetadata(@Param("afterId") long afterId, Pageable page);

    @Query("""
            select c from GitCommit c join fetch c.repository r join fetch r.installation
             where c.parentCount is null and c.id in :ids and r.status in ('ACTIVE', 'ERROR')
             order by c.id""")
    List<GitCommit> findMissingMetadataByIds(@Param("ids") Collection<Long> ids, Pageable page);

    /** SHAs among {@code shas} already stored for the repository connection. */
    @Query("select c.sha from GitCommit c where c.repository.id = :repositoryId and c.sha in :shas")
    List<String> findExistingShas(@Param("repositoryId") Long repositoryId, @Param("shas") Collection<String> shas);

    long countByRepository_Id(Long repositoryId);

    /** GI-05: commits of all the connections of a project. */
    long countByRepository_IdIn(Collection<Long> repositoryIds);

    /** GI-05: commits per connection, as rows of (repositoryId, count). */
    @Query("select c.repository.id, count(c) from GitCommit c where c.repository.id in :repositoryIds group by c.repository.id")
    List<Object[]> countGroupedByRepository(@Param("repositoryIds") Collection<Long> repositoryIds);

    /** SY-01: stored commits among {@code shas}, to fill what a push payload lacked. */
    List<GitCommit> findByRepository_IdAndShaIn(Long repositoryId, Collection<String> shas);

    Optional<GitCommit> findFirstByRepository_IdAndSha(Long repositoryId, String sha);

    Optional<GitCommit> findFirstByRepository_IdOrderByCommittedAtDescIdDesc(Long repositoryId);

    /** GI-05: the latest commit among the connections of a project. */
    Optional<GitCommit> findFirstByRepository_IdInOrderByCommittedAtDescIdDesc(Collection<Long> repositoryIds);

    /** WS-GH-02: commits of one calendar day. */
    interface DayCountRow {
        LocalDate getDay();
        Long getCount();
    }

    /** WS-GH-02: commits of {@code [from, to)} per calendar day (days without commits are absent). */
    @Query("""
            select cast(c.committedAt as LocalDate) as day, count(c) as count
              from GitCommit c
             where c.repository.id in :repositoryIds and c.committedAt >= :from and c.committedAt < :to
             group by cast(c.committedAt as LocalDate)""")
    List<DayCountRow> commitsPerDay(@Param("repositoryIds") Collection<Long> repositoryIds, @Param("from") LocalDateTime from,
                                    @Param("to") LocalDateTime to);

    /**
     * WS-GH-02: commits of {@code [from, to)} per author identity, most recently active first (several rows of
     * one person are merged in Java, like {@link #authorActivity}).
     */
    @Query("""
            select c.authorGithubId as githubId, c.authorEmail as email, c.authorLogin as login, c.authorName as name,
                   count(c) as count, min(c.committedAt) as firstAt, max(c.committedAt) as lastAt
              from GitCommit c
             where c.repository.id in :repositoryIds and c.committedAt >= :from and c.committedAt < :to
             group by c.authorGithubId, c.authorEmail, c.authorLogin, c.authorName
             order by max(c.committedAt) desc""")
    List<AuthorActivityRow> authorsBetween(@Param("repositoryIds") Collection<Long> repositoryIds,
                                           @Param("from") LocalDateTime from, @Param("to") LocalDateTime to);

    /** WS-GH-02: branches the commits of {@code [from, to)} were first pushed to, latest activity first. */
    @Query("""
            select c.firstSeenRef as ref, count(c) as commits, max(c.committedAt) as lastCommitAt
              from GitCommit c
             where c.repository.id in :repositoryIds and c.committedAt >= :from and c.committedAt < :to
               and c.firstSeenRef like 'refs/heads/%'
             group by c.firstSeenRef
             order by max(c.committedAt) desc, c.firstSeenRef""")
    List<BranchRow> branchesBetween(@Param("repositoryIds") Collection<Long> repositoryIds,
                                    @Param("from") LocalDateTime from, @Param("to") LocalDateTime to, Pageable page);

    /** WS-GH-02: when the first synchronized commit of the repositories was made (start of "all time"). */
    @Query("select min(c.committedAt) from GitCommit c where c.repository.id in :repositoryIds")
    LocalDateTime earliestCommittedAt(@Param("repositoryIds") Collection<Long> repositoryIds);

    /** GI-06: all-time commits of a master project per author identity (several rows per person are merged in Java). */
    interface AuthorActivityRow {
        Long getGithubId();
        String getEmail();
        String getLogin();
        String getName();
        Long getCount();
        LocalDateTime getFirstAt();
        LocalDateTime getLastAt();
    }

    @Query("""
            select c.authorGithubId as githubId, c.authorEmail as email, c.authorLogin as login, c.authorName as name,
                   count(c) as count, min(c.committedAt) as firstAt, max(c.committedAt) as lastAt
              from GitCommit c
             where c.project.id = :masterId
             group by c.authorGithubId, c.authorEmail, c.authorLogin, c.authorName""")
    List<AuthorActivityRow> authorActivity(@Param("masterId") Long masterId);

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
             where c.repository.id = :repositoryId and c.firstSeenRef like 'refs/heads/%'
               and lower(c.firstSeenRef) like :pattern
             group by c.firstSeenRef
             order by max(c.committedAt) desc, c.firstSeenRef""")
    List<BranchRow> branches(@Param("repositoryId") Long repositoryId, @Param("pattern") String pattern, Pageable page);
}
