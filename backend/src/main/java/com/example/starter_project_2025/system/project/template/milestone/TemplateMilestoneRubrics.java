package com.example.starter_project_2025.system.project.template.milestone;

import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneValidator;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersion;
import com.example.starter_project_2025.system.project.rubric.service.RubricCatalogService;
import com.example.starter_project_2025.system.project.template.ProjectTemplateException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TemplateMilestoneRubrics {
    private final RubricCatalogService catalog;
    private final MilestoneValidator validator;

    public Map<UUID, RubricVersion> requirePublished(TemplateMilestonePlanRequest request, Long tenantId) {
        Map<UUID, RubricVersion> versions = new LinkedHashMap<>();
        Map<String, List<String>> errors = new LinkedHashMap<>();
        for (int index = 0; index < request.milestones().size(); index++) {
            UUID id = request.milestones().get(index).rubricVersionId();
            String field = "milestones[" + index + "].rubricVersionId";
            if (id == null) continue;
            var version = versions.containsKey(id) ? java.util.Optional.of(versions.get(id))
                    : catalog.findPublished(id, tenantId);
            if (version.isEmpty()) {
                errors.put(field, List.of("Select a published rubric version from your tenant"));
                continue;
            }
            try {
                validator.validateRubric(RubricCatalogService.snapshot(version.get()));
                versions.put(id, version.get());
            } catch (MilestoneValidationException exception) {
                errors.put(field, exception.getErrors().values().stream().flatMap(List::stream).toList());
            }
        }
        if (!errors.isEmpty()) throw new ProjectTemplateException(422, "Select valid published rubrics", errors);
        return versions;
    }
}
