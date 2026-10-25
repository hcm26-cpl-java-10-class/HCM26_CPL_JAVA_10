package com.example.starter_project_2025.system.project.task.alert;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.*;
public interface TaskAlertProjectLinkRepository extends JpaRepository<TaskAlertData.ProjectLink, UUID> {
    Optional<TaskAlertData.ProjectLink> findByProjectId(Long projectId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select link from TaskAlertProjectLink link where link.id = :id")
    Optional<TaskAlertData.ProjectLink> lock(@Param("id") UUID id);
}
