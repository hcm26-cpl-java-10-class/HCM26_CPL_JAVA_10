package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitPullRequest;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;
import org.springframework.data.jpa.repository.JpaRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface GitPullRequestRepository extends JpaRepository<GitPullRequest, Long>, JpaSpecificationExecutor<GitPullRequest> {

    Optional<GitPullRequest> findByRepositoryIdAndNumber(Long repositoryId, Integer number);

    /**
     * Merged pull requests linked to a task whose stored merge commit has no MERGED_PR reference
     * yet (merged before TM-03, or the commit named the tasks itself: then a no-op).
     */
    @Query("""
            select p.id from GitPullRequest p
             where p.state = com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState.MERGED and p.mergeCommitSha is not null
               and (:repositoryId is null or p.repositoryId = :repositoryId)
               and exists (select l.id from BacklogGitLink l
                            where l.artifactType = com.example.starter_project_2025.system.git_integration.domain.GitArtifactType.PULL_REQUEST and l.artifactId = p.id)
               and exists (select c.id from GitCommit c where c.repositoryId = p.repositoryId and c.sha = p.mergeCommitSha
                             and not exists (select r.id from BacklogReference r
                                              where r.sourceType = com.example.starter_project_2025.system.git_integration.domain.GitArtifactType.COMMIT and r.sourceId = c.id
                                                and r.sourceField = com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceField.MERGED_PR))
             order by p.id""")
    List<Long> findMergedWithoutInheritedLinks(@Param("repositoryId") Long repositoryId);

    /** Merged pull requests whose merge commit is one of {@code shas} (match the repository too). */
    List<GitPullRequest> findByStateAndMergeCommitShaIn(GitPullRequestState state, Collection<String> shas);

    long countByRepositoryId(Long repositoryId);

    /** GI-05: pull requests of all the connections of a project. */
    long countByRepositoryIdIn(Collection<Long> repositoryIds);

    /** GI-05: pull requests per connection, as rows of (repositoryId, count). */
    @Query("select p.repositoryId, count(p) from GitPullRequest p where p.repositoryId in :repositoryIds group by p.repositoryId")
    List<Object[]> countGroupedByRepository(@Param("repositoryIds") Collection<Long> repositoryIds);

    /** GI-05: the newest pull request with this number among the connections of a project. */
    Optional<GitPullRequest> findFirstByRepositoryIdInAndNumberOrderByIdDesc(Collection<Long> repositoryIds, int number);

    /**
     * TM-03: row lock that serialises the automatic mapping and the manual link / unlink of
     * one pull request, so an unlink is never undone by a mapping run that read before it.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from GitPullRequest p where p.id = :id")
    Optional<GitPullRequest> lockById(@Param("id") Long id);

    /**
     * TM-03 link picker: pull requests of a repository whose title matches {@code pattern}
     * (lower case LIKE) or whose number is {@code number}; open ones first, then newest update.
     */
    @Query("""
            select p from GitPullRequest p
             where p.repositoryId = :repositoryId
               and (lower(p.title) like :pattern or p.number = :number)
             order by case when p.state = com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState.OPEN then 0 else 1 end,
                      p.githubUpdatedAt desc, p.id desc""")
    List<GitPullRequest> search(@Param("repositoryId") Long repositoryId, @Param("pattern") String pattern,
                                @Param("number") Integer number, Pageable page);

    /** Rows of (state, count) for the repository connection. */
    @Query("select p.state, count(p) from GitPullRequest p where p.repositoryId in :repositoryIds group by p.state")
    List<Object[]> countByState(@Param("repositoryIds") Collection<Long> repositoryIds);

    /** WS-GH-02: the columns insights need of one pull request. */
    interface PullRequestStatRow {
        String getAuthorLogin();
        /** GI-06: resolves the pull request to a project member. */
        Long getAuthorGithubId();
        LocalDateTime getGithubCreatedAt();
        LocalDateTime getMergedAt();
    }

    /** WS-GH-02: pull requests opened in {@code [from, to)}. */
    @Query("""
            select p.authorLogin as authorLogin, p.authorGithubId as authorGithubId,
                   p.githubCreatedAt as githubCreatedAt, p.mergedAt as mergedAt
              from GitPullRequest p
             where p.repositoryId in :repositoryIds and p.githubCreatedAt >= :from and p.githubCreatedAt < :to""")
    List<PullRequestStatRow> openedBetween(@Param("repositoryIds") Collection<Long> repositoryIds, @Param("from") LocalDateTime from,
                                           @Param("to") LocalDateTime to);

    /** WS-GH-02: pull requests merged in {@code [from, to)}. */
    @Query("""
            select p.authorLogin as authorLogin, p.authorGithubId as authorGithubId,
                   p.githubCreatedAt as githubCreatedAt, p.mergedAt as mergedAt
              from GitPullRequest p
             where p.repositoryId in :repositoryIds and p.mergedAt >= :from and p.mergedAt < :to""")
    List<PullRequestStatRow> mergedBetween(@Param("repositoryIds") Collection<Long> repositoryIds, @Param("from") LocalDateTime from,
                                           @Param("to") LocalDateTime to);

    /** GI-06: all-time pull requests of a master project per author. */
    interface AuthorCountRow {
        Long getGithubId();
        String getLogin();
        Long getCount();
        LocalDateTime getFirstAt();
        LocalDateTime getLastAt();
    }

    @Query("""
            select p.authorGithubId as githubId, p.authorLogin as login, count(p) as count,
                   min(p.githubCreatedAt) as firstAt, max(p.githubCreatedAt) as lastAt
              from GitPullRequest p
             where p.projectId = :masterId
             group by p.authorGithubId, p.authorLogin""")
    List<AuthorCountRow> authorActivity(@Param("masterId") Long masterId);

    /** WS-GH-02: pull requests in a state, the longest without update first. */
    List<GitPullRequest> findByRepositoryIdInAndStateOrderByGithubUpdatedAtAscIdAsc(Collection<Long> repositoryIds,
                                                                                    GitPullRequestState state, Pageable page);
}
