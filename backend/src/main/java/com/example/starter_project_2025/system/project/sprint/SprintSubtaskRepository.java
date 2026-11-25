package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.system.project.task.Task;
import com.example.starter_project_2025.system.project.task.TaskStatus;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

public interface SprintSubtaskRepository extends Repository<Task, UUID> {
    @Query("""
            select subtask.title
            from ProjectTask subtask
            where subtask.isActive = true
              and subtask.backlogItem is not null
              and subtask.backlogItem.sprint.id = :sprintId
              and (subtask.status is null or subtask.status <> :done)
            order by subtask.id asc
            """)
    List<String> findUnfinishedTitles(@Param("sprintId") Long sprintId, @Param("done") TaskStatus done);

    default List<String> findUnfinishedSubtaskTitlesBySprintId(Long sprintId) {
        return findUnfinishedTitles(sprintId, TaskStatus.DONE);
    }
}
