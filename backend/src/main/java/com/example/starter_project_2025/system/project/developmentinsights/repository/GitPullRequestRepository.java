package com.example.starter_project_2025.system.project.developmentinsights.repository;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequest;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitContributor;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequestState;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@org.springframework.stereotype.Repository("activityGitPullRequestRepository")
public interface GitPullRequestRepository extends JpaRepository<GitPullRequest, Long> {
    long countByRepository_Id(Long repositoryId);

    List<GitPullRequest> findAllByRepository_IdOrderByCreatedAtAscIdAsc(Long repositoryId);

    Optional<GitPullRequest> findFirstByRepository_IdAndExternalId(Long repositoryId, Long externalId);

    @Query(value = """
            select distinct pr from ActivityGitPullRequest pr
            join pr.repository r
            left join pr.authorContributor author
            left join TaskGitLink link on link.pullRequest.id = pr.id
            left join link.task linkedTask
            where r.rootProject.id = :rootId
              and (r.mockData = false or not exists (select sourceRepo.id from ActivityGitRepository sourceRepo where sourceRepo.rootProject.id = r.rootProject.id and sourceRepo.mockData = false))
              and (:rootScope = true or linkedTask.projectId in :projectIds
                   or (link.id is null and author.id in :contributorIds))
              and (:search is null or lower(pr.title) like lower(concat('%', :search, '%'))
                   or lower(pr.body) like lower(concat('%', :search, '%'))
                   or lower(author.login) like lower(concat('%', :search, '%'))
                   or lower(author.displayName) like lower(concat('%', :search, '%'))
                   or cast(pr.number as string) like concat('%', :search, '%'))
              and (:fromTime is null or pr.createdAt >= :fromTime)
              and (:untilTime is null or pr.createdAt < :untilTime)
              and (:developerId is null or author.user.id = :developerId)
              and (:taskId is null or exists (select taskLink.id from TaskGitLink taskLink
                   where taskLink.pullRequest.id = pr.id and taskLink.task.id = :taskId))
              and (:filterProjectId is null or (:filterProjectId = :rootId and :rootScope = true)
                   or exists (select selectedLink.id from TaskGitLink selectedLink
                   where selectedLink.pullRequest.id = pr.id and selectedLink.task.projectId = :filterProjectId)
                   or (not exists (select anyLink.id from TaskGitLink anyLink where anyLink.pullRequest.id = pr.id)
                       and author.id in :projectContributorIds))
            """,
            countQuery = """
            select count(distinct pr.id) from ActivityGitPullRequest pr
            join pr.repository r
            left join pr.authorContributor author
            left join TaskGitLink link on link.pullRequest.id = pr.id
            left join link.task linkedTask
            where r.rootProject.id = :rootId
              and (r.mockData = false or not exists (select sourceRepo.id from ActivityGitRepository sourceRepo where sourceRepo.rootProject.id = r.rootProject.id and sourceRepo.mockData = false))
              and (:rootScope = true or linkedTask.projectId in :projectIds
                   or (link.id is null and author.id in :contributorIds))
              and (:search is null or lower(pr.title) like lower(concat('%', :search, '%'))
                   or lower(pr.body) like lower(concat('%', :search, '%'))
                   or lower(author.login) like lower(concat('%', :search, '%'))
                   or lower(author.displayName) like lower(concat('%', :search, '%'))
                   or cast(pr.number as string) like concat('%', :search, '%'))
              and (:fromTime is null or pr.createdAt >= :fromTime)
              and (:untilTime is null or pr.createdAt < :untilTime)
              and (:developerId is null or author.user.id = :developerId)
              and (:taskId is null or exists (select taskLink.id from TaskGitLink taskLink
                   where taskLink.pullRequest.id = pr.id and taskLink.task.id = :taskId))
              and (:filterProjectId is null or (:filterProjectId = :rootId and :rootScope = true)
                   or exists (select selectedLink.id from TaskGitLink selectedLink
                   where selectedLink.pullRequest.id = pr.id and selectedLink.task.projectId = :filterProjectId)
                   or (not exists (select anyLink.id from TaskGitLink anyLink where anyLink.pullRequest.id = pr.id)
                       and author.id in :projectContributorIds))
            """)
    Page<GitPullRequest> findVisiblePage(@Param("rootId") Long rootId,
                                         @Param("rootScope") boolean rootScope,
                                         @Param("projectIds") Collection<Long> projectIds,
                                         @Param("contributorIds") Collection<Long> contributorIds,
                                         @Param("projectContributorIds") Collection<Long> projectContributorIds,
                                         @Param("search") String search,
                                         @Param("fromTime") Instant fromTime,
                                         @Param("untilTime") Instant untilTime,
                                         @Param("developerId") Long developerId,
                                         @Param("taskId") Long taskId,
                                         @Param("filterProjectId") Long filterProjectId,
                                         Pageable pageable);

    @Query("""
            select distinct pr from ActivityGitPullRequest pr
            join pr.repository r
            left join pr.authorContributor author
            left join TaskGitLink link on link.pullRequest.id = pr.id
            left join link.task linkedTask
            where r.rootProject.id = :rootId
              and (r.mockData = false or not exists (select sourceRepo.id from ActivityGitRepository sourceRepo
                   where sourceRepo.rootProject.id = r.rootProject.id and sourceRepo.mockData = false))
              and (:rootScope = true or linkedTask.projectId in :projectIds
                   or (link.id is null and author.id in :contributorIds))
              and (:fromTime is null or pr.createdAt >= :fromTime)
              and (:untilTime is null or pr.createdAt < :untilTime)
              and (:developerId is null or author.user.id = :developerId)
              and (:filterProjectId is null or (:filterProjectId = :rootId and :rootScope = true)
                   or exists (select selectedLink.id from TaskGitLink selectedLink
                   where selectedLink.pullRequest.id = pr.id and selectedLink.task.projectId = :filterProjectId)
                   or (not exists (select anyLink.id from TaskGitLink anyLink where anyLink.pullRequest.id = pr.id)
                       and author.id in :projectContributorIds))
              and (:taskId is null or exists (select taskLink.id from TaskGitLink taskLink
                   where taskLink.pullRequest.id = pr.id and taskLink.task.id = :taskId))
            """)
    List<GitPullRequest> findVisibleForAnalytics(@Param("rootId") Long rootId,
                                                 @Param("rootScope") boolean rootScope,
                                                 @Param("projectIds") Collection<Long> projectIds,
                                                 @Param("contributorIds") Collection<Long> contributorIds,
                                                 @Param("projectContributorIds") Collection<Long> projectContributorIds,
                                                 @Param("fromTime") Instant fromTime,
                                                 @Param("untilTime") Instant untilTime,
                                                 @Param("developerId") Long developerId,
                                                 @Param("filterProjectId") Long filterProjectId,
                                                 @Param("taskId") Long taskId);

    @Query("""
            select distinct pr from ActivityGitPullRequest pr
            join pr.repository r
            left join pr.authorContributor author
            left join TaskGitLink link on link.pullRequest.id = pr.id
            left join link.task linkedTask
            where r.rootProject.id = :rootId
              and (r.mockData = false or not exists (select sourceRepo.id from ActivityGitRepository sourceRepo
                   where sourceRepo.rootProject.id = r.rootProject.id and sourceRepo.mockData = false))
              and (:rootScope = true or linkedTask.projectId in :projectIds
                   or (link.id is null and author.id in :contributorIds))
              and ((:fromTime is null and :untilTime is null)
                   or ((:fromTime is null or pr.createdAt >= :fromTime)
                       and (:untilTime is null or pr.createdAt < :untilTime))
                   or (pr.state = :mergedState and pr.mergedAt is not null
                       and (:fromTime is null or pr.mergedAt >= :fromTime)
                       and (:untilTime is null or pr.mergedAt < :untilTime)))
              and (:developerId is null or author.user.id = :developerId)
              and (:filterProjectId is null or (:filterProjectId = :rootId and :rootScope = true)
                   or exists (select selectedLink.id from TaskGitLink selectedLink
                   where selectedLink.pullRequest.id = pr.id and selectedLink.task.projectId = :filterProjectId)
                   or (not exists (select anyLink.id from TaskGitLink anyLink where anyLink.pullRequest.id = pr.id)
                       and author.id in :projectContributorIds))
              and (:taskId is null or exists (select taskLink.id from TaskGitLink taskLink
                   where taskLink.pullRequest.id = pr.id and taskLink.task.id = :taskId))
            """)
    List<GitPullRequest> findVisibleForDevelopmentReport(@Param("rootId") Long rootId,
                                                          @Param("rootScope") boolean rootScope,
                                                          @Param("projectIds") Collection<Long> projectIds,
                                                          @Param("contributorIds") Collection<Long> contributorIds,
                                                          @Param("projectContributorIds") Collection<Long> projectContributorIds,
                                                          @Param("fromTime") Instant fromTime,
                                                          @Param("untilTime") Instant untilTime,
                                                          @Param("mergedState") GitPullRequestState mergedState,
                                                          @Param("developerId") Long developerId,
                                                          @Param("filterProjectId") Long filterProjectId,
                                                          @Param("taskId") Long taskId);

    @Query("""
            select distinct author from ActivityGitPullRequest pr
            join pr.repository r
            join pr.authorContributor author
            left join TaskGitLink link on link.pullRequest.id = pr.id
            left join link.task linkedTask
            where r.rootProject.id = :rootId
              and (r.mockData = false or not exists (select sourceRepo.id from ActivityGitRepository sourceRepo where sourceRepo.rootProject.id = r.rootProject.id and sourceRepo.mockData = false))
              and author.user is not null
              and (:rootScope = true or linkedTask.projectId in :projectIds
                   or (link.id is null and author.id in :contributorIds))
              and (:filterProjectId is null or (:filterProjectId = :rootId and :rootScope = true)
                   or exists (select selectedLink.id from TaskGitLink selectedLink
                   where selectedLink.pullRequest.id = pr.id and selectedLink.task.projectId = :filterProjectId)
                   or (not exists (select anyLink.id from TaskGitLink anyLink where anyLink.pullRequest.id = pr.id)
                       and author.id in :projectContributorIds))
            """)
    List<GitContributor> findVisibleContributors(@Param("rootId") Long rootId,
                                                 @Param("rootScope") boolean rootScope,
                                                 @Param("projectIds") Collection<Long> projectIds,
                                                 @Param("contributorIds") Collection<Long> contributorIds,
                                                 @Param("filterProjectId") Long filterProjectId,
                                                 @Param("projectContributorIds") Collection<Long> projectContributorIds);

    @Query("""
            select pr from ActivityGitPullRequest pr join pr.repository r
            where pr.id = :pullRequestId and r.rootProject.id = :rootId
              and (r.mockData = false or not exists (select sourceRepo.id from ActivityGitRepository sourceRepo where sourceRepo.rootProject.id = r.rootProject.id and sourceRepo.mockData = false))
            """)
    Optional<GitPullRequest> findInRoot(@Param("rootId") Long rootId, @Param("pullRequestId") Long pullRequestId);

    @Query("""
            select case when count(pr) > 0 then true else false end
            from ActivityGitPullRequest pr join pr.repository r
            left join TaskGitLink link on link.pullRequest.id = pr.id
            left join link.task linkedTask
            where pr.id = :pullRequestId and r.rootProject.id = :rootId
              and (r.mockData = false or not exists (select sourceRepo.id from ActivityGitRepository sourceRepo where sourceRepo.rootProject.id = r.rootProject.id and sourceRepo.mockData = false))
              and (:rootScope = true or linkedTask.projectId in :projectIds
                   or (link.id is null and pr.authorContributor.id in :contributorIds))
            """)
    boolean isVisible(@Param("rootId") Long rootId, @Param("pullRequestId") Long pullRequestId,
                      @Param("rootScope") boolean rootScope,
                      @Param("projectIds") Collection<Long> projectIds,
                      @Param("contributorIds") Collection<Long> contributorIds);
}
