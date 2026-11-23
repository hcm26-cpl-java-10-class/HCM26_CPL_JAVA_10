package com.example.starter_project_2025.system.project.developmentinsights.repository;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommit;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitContributor;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GitCommitRepository extends JpaRepository<GitCommit, Long> {
    long countByRepository_Id(Long repositoryId);

    List<GitCommit> findAllByRepository_IdOrderByCommittedAtAscIdAsc(Long repositoryId);
    List<GitCommit> findAllByRepository_IdInOrderByCommittedAtAscIdAsc(Collection<Long> repositoryIds);

    @Query("""
            select distinct author from GitCommit c
            join c.repository r
            join c.authorContributor author
            left join TaskGitLink link on link.commit.id = c.id
            left join link.task linkedTask
            where r.rootProject.id = :rootId
              and (r.mockData = false or not exists (select sourceRepo.id from GitRepository sourceRepo where sourceRepo.rootProject.id = r.rootProject.id and sourceRepo.mockData = false))
              and author.user is not null
              and (:rootScope = true or linkedTask.projectId in :projectIds
                   or (link.id is null and author.id in :contributorIds))
              and (:filterProjectId is null or (:filterProjectId = :rootId and :rootScope = true)
                   or exists (select selectedLink.id from TaskGitLink selectedLink
                   where selectedLink.commit.id = c.id and selectedLink.task.projectId = :filterProjectId)
                   or (not exists (select anyLink.id from TaskGitLink anyLink where anyLink.commit.id = c.id)
                       and author.id in :projectContributorIds))
            """)
    java.util.List<GitContributor> findVisibleContributors(@Param("rootId") Long rootId,
                                                           @Param("rootScope") boolean rootScope,
                                                           @Param("projectIds") Collection<Long> projectIds,
                                                           @Param("contributorIds") Collection<Long> contributorIds,
                                                           @Param("filterProjectId") Long filterProjectId,
                                                           @Param("projectContributorIds") Collection<Long> projectContributorIds);

    @Query(value = """
            select distinct c from GitCommit c
            join c.repository r
            left join c.authorContributor author
            left join TaskGitLink link on link.commit.id = c.id
            left join link.task linkedTask
            where r.rootProject.id = :rootId
              and (r.mockData = false or not exists (select sourceRepo.id from GitRepository sourceRepo where sourceRepo.rootProject.id = r.rootProject.id and sourceRepo.mockData = false))
              and (:rootScope = true or linkedTask.projectId in :projectIds
                   or (link.id is null and author.id in :contributorIds))
              and (:search is null or lower(c.sha) like lower(concat('%', :search, '%'))
                   or lower(c.message) like lower(concat('%', :search, '%'))
                   or lower(author.login) like lower(concat('%', :search, '%'))
                   or lower(author.displayName) like lower(concat('%', :search, '%')))
              and (:fromTime is null or c.committedAt >= :fromTime)
              and (:untilTime is null or c.committedAt < :untilTime)
              and (:developerId is null or author.user.id = :developerId)
              and (:contributorId is null or author.id = :contributorId)
              and (:branch is null or c.firstSeenBranch = :branch)
              and (:unmappedOnly is null or (:unmappedOnly = true and
                   (author.id is null or (author.user is null and author.bot = false))) or
                   (:unmappedOnly = false and author.user is not null))
              and (:includeBots is null or :includeBots = true or
                   (c.bot = false and (author.id is null or author.bot = false)))
              and (:includeMergeCommits is null or :includeMergeCommits = true or c.mergeCommit = false)
              and (:taskId is null or exists (select taskLink.id from TaskGitLink taskLink
                   where taskLink.commit.id = c.id and taskLink.task.id = :taskId))
              and (:filterProjectId is null or (:filterProjectId = :rootId and :rootScope = true)
                   or exists (select selectedLink.id from TaskGitLink selectedLink
                   where selectedLink.commit.id = c.id and selectedLink.task.projectId = :filterProjectId)
                   or (not exists (select anyLink.id from TaskGitLink anyLink where anyLink.commit.id = c.id)
                       and author.id in :projectContributorIds))
            """,
            countQuery = """
            select count(distinct c.id) from GitCommit c
            join c.repository r
            left join c.authorContributor author
            left join TaskGitLink link on link.commit.id = c.id
            left join link.task linkedTask
            where r.rootProject.id = :rootId
              and (r.mockData = false or not exists (select sourceRepo.id from GitRepository sourceRepo where sourceRepo.rootProject.id = r.rootProject.id and sourceRepo.mockData = false))
              and (:rootScope = true or linkedTask.projectId in :projectIds
                   or (link.id is null and author.id in :contributorIds))
              and (:search is null or lower(c.sha) like lower(concat('%', :search, '%'))
                   or lower(c.message) like lower(concat('%', :search, '%'))
                   or lower(author.login) like lower(concat('%', :search, '%'))
                   or lower(author.displayName) like lower(concat('%', :search, '%')))
              and (:fromTime is null or c.committedAt >= :fromTime)
              and (:untilTime is null or c.committedAt < :untilTime)
              and (:developerId is null or author.user.id = :developerId)
              and (:contributorId is null or author.id = :contributorId)
              and (:branch is null or c.firstSeenBranch = :branch)
              and (:unmappedOnly is null or (:unmappedOnly = true and
                   (author.id is null or (author.user is null and author.bot = false))) or
                   (:unmappedOnly = false and author.user is not null))
              and (:includeBots is null or :includeBots = true or
                   (c.bot = false and (author.id is null or author.bot = false)))
              and (:includeMergeCommits is null or :includeMergeCommits = true or c.mergeCommit = false)
              and (:taskId is null or exists (select taskLink.id from TaskGitLink taskLink
                   where taskLink.commit.id = c.id and taskLink.task.id = :taskId))
              and (:filterProjectId is null or (:filterProjectId = :rootId and :rootScope = true)
                   or exists (select selectedLink.id from TaskGitLink selectedLink
                   where selectedLink.commit.id = c.id and selectedLink.task.projectId = :filterProjectId)
                   or (not exists (select anyLink.id from TaskGitLink anyLink where anyLink.commit.id = c.id)
                       and author.id in :projectContributorIds))
            """)
    Page<GitCommit> findVisiblePage(@Param("rootId") Long rootId,
                                    @Param("rootScope") boolean rootScope,
                                    @Param("projectIds") Collection<Long> projectIds,
                                    @Param("contributorIds") Collection<Long> contributorIds,
                                    @Param("projectContributorIds") Collection<Long> projectContributorIds,
                                    @Param("search") String search,
                                    @Param("fromTime") Instant fromTime,
                                    @Param("untilTime") Instant untilTime,
                                    @Param("developerId") Long developerId,
                                    @Param("contributorId") Long contributorId,
                                    @Param("branch") String branch,
                                    @Param("unmappedOnly") Boolean unmappedOnly,
                                    @Param("includeBots") Boolean includeBots,
                                    @Param("includeMergeCommits") Boolean includeMergeCommits,
                                    @Param("taskId") Long taskId,
                                    @Param("filterProjectId") Long filterProjectId,
                                    Pageable pageable);

    @Query("""
            select distinct c from GitCommit c join c.repository r
            left join c.authorContributor author
            left join TaskGitLink link on link.commit.id = c.id
            left join link.task linkedTask
            where r.rootProject.id = :rootId
              and (r.mockData = false or not exists (select sourceRepo.id from GitRepository sourceRepo where sourceRepo.rootProject.id = r.rootProject.id and sourceRepo.mockData = false))
              and (:rootScope = true or linkedTask.projectId in :projectIds
                   or (link.id is null and author.id in :contributorIds))
              and (:filterProjectId is null or (:filterProjectId = :rootId and :rootScope = true)
                   or exists (select selectedLink.id from TaskGitLink selectedLink
                   where selectedLink.commit.id = c.id and selectedLink.task.projectId = :filterProjectId)
                   or (not exists (select anyLink.id from TaskGitLink anyLink where anyLink.commit.id = c.id)
                       and author.id in :projectContributorIds))
              and (:taskId is null or exists (select taskLink.id from TaskGitLink taskLink
                   where taskLink.commit.id = c.id and taskLink.task.id = :taskId))
            """)
    List<GitCommit> findVisibleForAnalytics(@Param("rootId") Long rootId,
                                            @Param("rootScope") boolean rootScope,
                                            @Param("projectIds") Collection<Long> projectIds,
                                            @Param("contributorIds") Collection<Long> contributorIds,
                                            @Param("filterProjectId") Long filterProjectId,
                                            @Param("projectContributorIds") Collection<Long> projectContributorIds,
                                            @Param("taskId") Long taskId);

    @Query("""
            select c from GitCommit c join c.repository r
            where c.id = :commitId and r.rootProject.id = :rootId
              and (r.mockData = false or not exists (select sourceRepo.id from GitRepository sourceRepo where sourceRepo.rootProject.id = r.rootProject.id and sourceRepo.mockData = false))
            """)
    Optional<GitCommit> findInRoot(@Param("rootId") Long rootId, @Param("commitId") Long commitId);

    @Query("""
            select case when count(c) > 0 then true else false end
            from GitCommit c join c.repository r
            left join TaskGitLink link on link.commit.id = c.id
            left join link.task linkedTask
            where c.id = :commitId and r.rootProject.id = :rootId
              and (r.mockData = false or not exists (select sourceRepo.id from GitRepository sourceRepo where sourceRepo.rootProject.id = r.rootProject.id and sourceRepo.mockData = false))
              and (:rootScope = true or linkedTask.projectId in :projectIds
                   or (link.id is null and c.authorContributor.id in :contributorIds))
            """)
    boolean isVisible(@Param("rootId") Long rootId, @Param("commitId") Long commitId,
                      @Param("rootScope") boolean rootScope,
                      @Param("projectIds") Collection<Long> projectIds,
                      @Param("contributorIds") Collection<Long> contributorIds);
}
