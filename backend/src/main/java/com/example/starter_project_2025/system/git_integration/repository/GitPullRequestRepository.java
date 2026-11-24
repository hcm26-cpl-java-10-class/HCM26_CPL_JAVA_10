package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.BacklogReferenceField;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequest;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequestState;
import jakarta.persistence.LockModeType;
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

public interface GitPullRequestRepository extends JpaRepository<GitPullRequest, Long>, JpaSpecificationExecutor<GitPullRequest> {
    Optional<GitPullRequest> findByRepository_IdAndExternalId(Long repositoryId, Long externalId);
    List<GitPullRequest> findByRepository_IdOrderByIdAsc(Long repositoryId);

    Optional<GitPullRequest> findByRepository_IdAndNumber(Long repositoryId, Integer number);

    /**
     * Merged pull requests linked to a task whose stored merge commit has no BacklogReferenceField.MERGED_PR reference
     * yet (merged before TM-03, or the commit named the tasks itself: then a no-op).
     */
    @Query("""
            select p.id from GitPullRequest p
             where p.state = GitPullRequestState.MERGED and p.mergeCommitSha is not null
               and (:repositoryId is null or p.repository.id = :repositoryId)
               and exists (select l.id from BacklogGitLink l
                            where l.artifactType = GitArtifactType.PULL_REQUEST and id(l.artifact) = p.id)
               and exists (select c.id from GitCommit c where c.repository.id = p.repository.id and c.sha = p.mergeCommitSha
                             and not exists (select r.id from BacklogReference r
                                              where r.sourceType = GitArtifactType.COMMIT and id(r.source) = c.id
                                                and r.sourceField = BacklogReferenceField.MERGED_PR))
             order by p.id""")
    List<Long> findMergedWithoutInheritedLinks(@Param("repositoryId") Long repositoryId);

    /** Merged pull requests whose merge commit is one of {@code shas} (match the repository too). */
    List<GitPullRequest> findByStateAndMergeCommitShaIn(GitPullRequestState state, Collection<String> shas);

    long countByRepository_Id(Long repositoryId);

    /** GI-05: pull requests of all the connections of a project. */
    long countByRepository_IdIn(Collection<Long> repositoryIds);

    /** GI-05: pull requests per connection, as rows of (repositoryId, count). */
    @Query("select p.repository.id, count(p) from GitPullRequest p where p.repository.id in :repositoryIds group by p.repository.id")
    List<Object[]> countGroupedByRepository(@Param("repositoryIds") Collection<Long> repositoryIds);

    /** GI-05: the newest pull request with this number among the connections of a project. */
    Optional<GitPullRequest> findFirstByRepository_IdInAndNumberOrderByIdDesc(Collection<Long> repositoryIds, int number);

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
             where p.repository.id = :repositoryId
               and (lower(p.title) like :pattern or p.number = :number)
             order by case when p.state = GitPullRequestState.OPEN then 0 else 1 end,
                      p.githubUpdatedAt desc, p.id desc""")
    List<GitPullRequest> search(@Param("repositoryId") Long repositoryId, @Param("pattern") String pattern,
                                @Param("number") Integer number, Pageable page);

    /** Rows of (state, count) for the repository connection. */
    @Query("select p.state, count(p) from GitPullRequest p where p.repository.id in :repositoryIds group by p.state")
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
             where p.repository.id in :repositoryIds and p.githubCreatedAt >= :from and p.githubCreatedAt < :to""")
    List<PullRequestStatRow> openedBetween(@Param("repositoryIds") Collection<Long> repositoryIds, @Param("from") LocalDateTime from,
                                           @Param("to") LocalDateTime to);

    /** WS-GH-02: pull requests merged in {@code [from, to)}. */
    @Query("""
            select p.authorLogin as authorLogin, p.authorGithubId as authorGithubId,
                   p.githubCreatedAt as githubCreatedAt, p.mergedAt as mergedAt
              from GitPullRequest p
             where p.repository.id in :repositoryIds and p.mergedAt >= :from and p.mergedAt < :to""")
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
             where p.project.id = :masterId
             group by p.authorGithubId, p.authorLogin""")
    List<AuthorCountRow> authorActivity(@Param("masterId") Long masterId);

    /** WS-GH-02: pull requests in a state, the longest without update first. */
    List<GitPullRequest> findByRepository_IdInAndStateOrderByGithubUpdatedAtAscIdAsc(Collection<Long> repositoryIds,
                                                                                    GitPullRequestState state, Pageable page);
}
