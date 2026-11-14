package com.example.starter_project_2025.system.project.aiassistant.dto;

import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewResourceContext;
import com.example.starter_project_2025.system.project.resources.template_resources.TemplateResource;
import org.springframework.stereotype.Component;

@Component
public class ReviewResourceContextMapper {

    public ReviewResourceContext toContext(TemplateResource resource) {
        return new ReviewResourceContext(
                resource.getId(),
                resource.getTitle(),
                resource.getDescription(),
                resource.getKind().name(),
                resource.getUrl(),
                resource.getOrderIndex()
        );
    }
}