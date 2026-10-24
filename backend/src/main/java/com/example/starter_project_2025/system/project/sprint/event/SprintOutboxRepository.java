package com.example.starter_project_2025.system.project.sprint.event;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SprintOutboxRepository extends JpaRepository<SprintOutboxEvent, Long> {

    boolean existsByDedupeKey(String dedupeKey);

    List<SprintOutboxEvent> findTop50ByStatusOrderByIdAsc(SprintOutboxStatus status);
}
