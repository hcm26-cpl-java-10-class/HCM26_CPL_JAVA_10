package com.example.starter_project_2025.system.project.project_template_version.event;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectTemplateSnapshotOutboxRepository
        extends JpaRepository<ProjectTemplateSnapshotOutboxEvent, Long> {

    boolean existsByDedupeKey(String dedupeKey);

    List<ProjectTemplateSnapshotOutboxEvent> findTop50ByStatusOrderByIdAsc(
            ProjectTemplateSnapshotOutboxStatus status);
}
