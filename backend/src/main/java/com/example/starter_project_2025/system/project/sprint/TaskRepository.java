package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository("sprintTaskRepository")
public interface TaskRepository extends BaseCrudRepository<Task, Long> {

    Optional<Task> findByProjectIdAndCode(Long projectId, String code);

    Optional<Task> findByIdAndProjectIdAndIsActiveTrue(Long id, Long projectId);

    @Query(
            value = """
                    SELECT t FROM Task t
                    WHERE t.projectId = :projectId
                      AND t.isActive = true
                      AND (:sprintId IS NULL OR t.sprintId IS NULL OR t.sprintId = :sprintId)
                      AND (:status IS NULL OR t.status = :status)
                      AND (:assigneeMemberId IS NULL OR t.assigneeProjectMemberId = :assigneeMemberId)
                      AND (:unassigned IS NULL
                           OR (:unassigned = true AND t.assigneeProjectMemberId IS NULL)
                           OR (:unassigned = false AND t.assigneeProjectMemberId IS NOT NULL))
                      AND (:search IS NULL
                           OR LOWER(t.title) LIKE LOWER(CONCAT('%', :search, '%'))
                           OR LOWER(t.code) LIKE LOWER(CONCAT('%', :search, '%')))
                    """,
            countQuery = """
                    SELECT COUNT(t) FROM Task t
                    WHERE t.projectId = :projectId
                      AND t.isActive = true
                      AND (:sprintId IS NULL OR t.sprintId IS NULL OR t.sprintId = :sprintId)
                      AND (:status IS NULL OR t.status = :status)
                      AND (:assigneeMemberId IS NULL OR t.assigneeProjectMemberId = :assigneeMemberId)
                      AND (:unassigned IS NULL
                           OR (:unassigned = true AND t.assigneeProjectMemberId IS NULL)
                           OR (:unassigned = false AND t.assigneeProjectMemberId IS NOT NULL))
                      AND (:search IS NULL
                           OR LOWER(t.title) LIKE LOWER(CONCAT('%', :search, '%'))
                           OR LOWER(t.code) LIKE LOWER(CONCAT('%', :search, '%')))
                    """
    )
    Page<Task> searchProjectTasks(
            @Param("projectId") Long projectId,
            @Param("sprintId") Long sprintId,
            @Param("status") TaskStatus status,
            @Param("assigneeMemberId") Long assigneeMemberId,
            @Param("unassigned") Boolean unassigned,
            @Param("search") String search,
            Pageable pageable
    );

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Transactional
    @Query("""
            UPDATE Task t
            SET t.status = :status, t.version = t.version + 1
            WHERE t.id = :taskId
              AND t.projectId = :projectId
              AND t.isActive = true
              AND t.version = :expectedVersion
            """)
    int updateStatusIfVersionMatches(
            @Param("projectId") Long projectId,
            @Param("taskId") Long taskId,
            @Param("status") TaskStatus status,
            @Param("expectedVersion") Long expectedVersion
    );

    List<Task> findByProjectIdAndSprintIdIsNullAndIsActiveTrueOrderByOrderIndexAscIdAsc(Long projectId);

    List<Task> findByProjectIdAndIsActiveTrueOrderByOrderIndexAscIdAsc(Long projectId);

    List<Task> findByProjectIdAndSprintIdAndIsActiveTrueOrderByOrderIndexAscIdAsc(
            Long projectId,
            Long sprintId
    );

    List<Task> findByTeamIdAndSprintIdIsNullAndIsActiveTrueOrderByOrderIndexAscIdAsc(Long teamId);

    List<Task> findByTeamIdAndSprintIdAndIsActiveTrueOrderByOrderIndexAscIdAsc(Long teamId, Long sprintId);

    List<Task> findBySprintIdOrderByOrderIndexAsc(@Param("sprintId") Long sprintId);

    List<Task> findBySprintIdAndIsActiveTrue(Long sprintId);

    List<Task> findBySprintIdAndStatus(@Param("sprintId") Long sprintId, @Param("status") TaskStatus status);

    @Query("""
            SELECT t FROM Task t
            WHERE t.projectId = :projectId
              AND t.status != 'DONE'
              AND t.assigneeProjectMemberId = :memberId
            """)
    List<Task> findActiveTasksByAssignee(@Param("projectId") Long projectId, @Param("memberId") Long memberId);

    @Query("""
            SELECT t FROM Task t
            WHERE t.sprintId = :sprintId
              AND t.status IN ('IN_PROGRESS', 'REVIEW')
            """)
    List<Task> findInProgressTasksBySprint(@Param("sprintId") Long sprintId);

    @Query("""
            SELECT COUNT(t) FROM Task t
            WHERE t.sprintId = :sprintId
              AND t.status = :status
            """)
    Long countBySprintIdAndStatus(@Param("sprintId") Long sprintId, @Param("status") TaskStatus status);
}
