package com.example.starter_project_2025.system.project.template.milestone;

import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface TemplateMilestoneRepository extends JpaRepository<TemplateMilestone, Long> {
    @EntityGraph(attributePaths = "checklistItems")
    List<TemplateMilestone> findAllByTemplate_IdOrderByOrderIndexAscIdAsc(Long templateId);

    @Query("select distinct m from TemplateMilestone m left join fetch m.rubricCriteria where m.template.id = :templateId")
    List<TemplateMilestone> findWithRubricCriteria(Long templateId);
}
