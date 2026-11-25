package com.example.starter_project_2025.system.project.developmentinsights.repository;

import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLink;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskGitLinkRepository extends JpaRepository<TaskGitLink, Long> {
    List<TaskGitLink> findAllByCommit_IdOrderByTask_IdAsc(Long commitId);
    List<TaskGitLink> findAllByTask_IdOrderByIdAsc(Long taskId);
    List<TaskGitLink> findAllByTask_IdInOrderByTask_IdAsc(Collection<Long> taskIds);
    List<TaskGitLink> findAllByPullRequest_IdOrderByTask_IdAsc(Long pullRequestId);
    List<TaskGitLink> findAllByCommit_IdIn(Collection<Long> commitIds);
    List<TaskGitLink> findAllByPullRequest_IdIn(Collection<Long> pullRequestIds);
    boolean existsByTask_IdAndPullRequest_Id(Long taskId, Long pullRequestId);
}
