package com.example.starter_project_2025.system.project.template.artifact;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TemplateArtifactRequirementRepository extends JpaRepository<TemplateArtifactRequirement, Long> {
    @EntityGraph(attributePaths = {"milestone", "allowedMimeTypes"})
    List<TemplateArtifactRequirement> findAllByTemplate_IdOrderByOrderIndexAscIdAsc(Long templateId);

    boolean existsByMilestone_IdIn(Collection<Long> milestoneIds);
}
