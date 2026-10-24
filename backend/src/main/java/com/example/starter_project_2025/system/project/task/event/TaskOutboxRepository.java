package com.example.starter_project_2025.system.project.task.event;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskOutboxRepository extends JpaRepository<TaskOutboxEvent, Long> {

    boolean existsByDedupeKey(String dedupeKey);

    Optional<TaskOutboxEvent> findByDedupeKey(String dedupeKey);

    List<TaskOutboxEvent> findTop50ByStatusOrderByIdAsc(TaskOutboxStatus status);
}
