package com.example.starter_project_2025.system.project.task.event;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface BoardTaskOutboxRepository extends JpaRepository<BoardTaskOutboxEvent, Long> {

    boolean existsByDedupeKey(String dedupeKey);

    Optional<BoardTaskOutboxEvent> findByDedupeKey(String dedupeKey);

    List<BoardTaskOutboxEvent> findTop50ByStatusOrderByIdAsc(TaskOutboxStatus status);
}
