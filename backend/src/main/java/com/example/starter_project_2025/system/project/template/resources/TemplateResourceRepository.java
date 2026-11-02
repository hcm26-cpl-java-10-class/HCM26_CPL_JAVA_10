package com.example.starter_project_2025.system.project.template.resources;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TemplateResourceRepository extends JpaRepository<TemplateResource, Long> {
    List<TemplateResource> findAllByTemplate_IdAndIsActiveTrueOrderByIdAsc(Long templateId);
    List<TemplateResource> findAllByTemplate_IdAndIdInOrderByIdAsc(Long templateId, Collection<Long> ids);
}
