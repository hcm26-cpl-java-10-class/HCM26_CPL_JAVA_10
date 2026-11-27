package com.example.starter_project_2025.system.project.aiassistant.dto;

import org.springframework.stereotype.Component;

@Component
public class ReviewNodeContextMapper {

    public ReviewNodeContext fromRoot(ReviewContext context) {
        return new ReviewNodeContext(
                context.templateId(),
                context.templateVersion(),
                context.code(),
                context.name(),
                context.description(),
                context.technologyStack(),
                context.category(),
                context.level(),
                context.estimatedDurationWeeks(),
                context.constraints(),
                context.milestones(),
                context.backlogItems(),
                context.resources(),
                context.rubrics()
        );
    }

    public ReviewNodeContext fromModule(ReviewTemplateNode module) {
        return new ReviewNodeContext(
                module.templateId(),
                module.templateVersion(),
                module.code(),
                module.name(),
                module.description(),
                module.technologyStack(),
                module.category(),
                module.level(),
                module.estimatedDurationWeeks(),
                module.constraints(),
                module.milestones(),
                module.backlogItems(),
                module.resources(),
                module.rubrics()
        );
    }
}