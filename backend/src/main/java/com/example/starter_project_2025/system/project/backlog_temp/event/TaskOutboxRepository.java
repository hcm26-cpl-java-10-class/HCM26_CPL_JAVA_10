package com.example.starter_project_2025.system.project.backlog_temp.event;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository("backlogItemOutboxRepository")
public interface TaskOutboxRepository extends JpaRepository<TaskOutboxEvent, Long> {

    boolean existsByDedupeKey(String dedupeKey);

    List<TaskOutboxEvent> findTop50ByStatusOrderByIdAsc(TaskOutboxStatus status);
}
