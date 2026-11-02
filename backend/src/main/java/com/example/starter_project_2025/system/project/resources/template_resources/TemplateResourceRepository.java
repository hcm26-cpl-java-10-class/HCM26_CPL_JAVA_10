package com.example.starter_project_2025.system.project.resources.template_resources;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TemplateResourceRepository extends BaseCrudRepository<TemplateResource, Long> {

    List<TemplateResource> findAllByTemplateIdOrderByOrderIndexAscIdAsc(Long templateId);

    long countByTemplateId(Long templateId);
}
