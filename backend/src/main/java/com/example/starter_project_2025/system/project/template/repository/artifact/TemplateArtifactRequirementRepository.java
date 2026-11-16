package com.example.starter_project_2025.system.project.template.repository.artifact;

import com.example.starter_project_2025.system.project.template.domain.artifact.TemplateArtifactRequirement;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TemplateArtifactRequirementRepository extends JpaRepository<TemplateArtifactRequirement, Long> {
    @EntityGraph(attributePaths = {"milestone", "allowedMimeTypes"})
    List<TemplateArtifactRequirement> findAllByTemplate_IdOrderByOrderIndexAscIdAsc(Long templateId);

    void deleteByMilestone_IdIn(Collection<Long> milestoneIds);
}
