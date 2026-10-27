package com.example.starter_project_2025.system.project.workspace.repository;

import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceOutboxEvent;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.Optional;

public interface WorkspaceOutboxRepository extends JpaRepository<WorkspaceOutboxEvent, Long> {
    List<WorkspaceOutboxEvent> findTop25ByDeliveredAtIsNullOrderByIdAsc();
    List<WorkspaceOutboxEvent> findByWorkspaceId(Long workspaceId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from WorkspaceOutboxEvent e where e.id = :id")
    Optional<WorkspaceOutboxEvent> findForDelivery(Long id);
}
