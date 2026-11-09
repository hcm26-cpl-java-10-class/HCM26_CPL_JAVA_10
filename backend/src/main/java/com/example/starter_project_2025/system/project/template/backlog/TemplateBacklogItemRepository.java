package com.example.starter_project_2025.system.project.template.backlog;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TemplateBacklogItemRepository extends JpaRepository<TemplateBacklogItem, Long> {
    List<TemplateBacklogItem> findAllByTemplate_IdOrderByOrderIndexAscIdAsc(Long templateId);
}
