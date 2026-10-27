package com.example.starter_project_2025.system.project.template.content;

import com.example.starter_project_2025.system.project.milestone.submission.service.ArtifactMimePolicy;
import com.example.starter_project_2025.system.project.template.ProjectTemplateException;
import com.example.starter_project_2025.system.project.template.artifact.TemplateArtifactType;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class TemplateSampleContentValidator {
    public static final int MAX_ITEMS = 1000;

    public void validate(TemplateSampleContentRequest request) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        try {
            if (request.lockVersion() == null || request.lockVersion().longValueExact() < 0) throw new ArithmeticException();
        } catch (ArithmeticException exception) {
            error(errors, "lockVersion", "A valid template revision is required. Please reload the template");
        }
        errors.putAll(backlogErrors(request.backlogItems(), "backlogItems"));
        if (request.artifacts() == null || request.artifacts().size() > MAX_ITEMS) {
            error(errors, "artifacts", "Provide an artifact list with at most " + MAX_ITEMS + " items");
        } else {
            Set<Long> ids = new HashSet<>();
            for (int i = 0; i < request.artifacts().size(); i++) {
                var item = request.artifacts().get(i); String path = "artifacts[" + i + "]";
                if (item == null) { error(errors, path, "Enter the artifact requirement"); continue; }
                id(errors, path + ".id", item.id(), ids, false);
                id(errors, path + ".milestoneId", item.milestoneId(), new HashSet<>(), true);
                text(errors, path + ".title", item.title(), 120, "Artifact name");
                description(errors, path + ".description", item.description(), 1000);
                if (item.type() == null) error(errors, path + ".type", "Select File or URL");
                var types = item.allowedMimeTypes();
                if (types == null) {
                    error(errors, path + ".allowedMimeTypes", "Provide a list of allowed file formats");
                } else if (item.type() == TemplateArtifactType.FILE && (types.isEmpty()
                        || types.stream().anyMatch(type -> type == null || !ArtifactMimePolicy.SUPPORTED_TYPES.contains(type))
                        || new HashSet<>(types).size() != types.size())) {
                    error(errors, path + ".allowedMimeTypes", "Select one or more supported file formats without duplicates");
                } else if (item.type() == TemplateArtifactType.URL && !types.isEmpty()) {
                    error(errors, path + ".allowedMimeTypes", "URL requirements must not contain file formats");
                }
            }
        }
        if (!errors.isEmpty()) throw new ProjectTemplateException(422, "Please correct the highlighted fields", errors);
    }

    public Map<String, List<String>> backlogErrors(List<TemplateSampleContentRequest.BacklogItem> items, String prefix) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (items == null || items.size() > MAX_ITEMS) {
            error(errors, prefix, "Provide a backlog list with at most " + MAX_ITEMS + " items"); return errors;
        }
        Set<Long> ids = new HashSet<>();
        for (int i = 0; i < items.size(); i++) {
            var item = items.get(i); String path = prefix + "[" + i + "]";
            if (item == null) { error(errors, path, "Enter the backlog item"); continue; }
            id(errors, path + ".id", item.id(), ids, false);
            text(errors, path + ".title", item.title(), 200, "Backlog title");
            description(errors, path + ".description", item.description(), 2000);
            if (item.suggestedRole() == null) error(errors, path + ".suggestedRole", "Select PM, BA, DEV or QA");
        }
        return errors;
    }

    private void id(Map<String, List<String>> errors, String path, BigDecimal value, Set<Long> ids, boolean required) {
        if (value == null && !required) return;
        try { if (value != null && value.longValueExact() > 0 && ids.add(value.longValueExact())) return; }
        catch (ArithmeticException ignored) { }
        error(errors, path, "Provide a valid, unique saved item ID");
    }

    private void text(Map<String, List<String>> errors, String path, String value, int max, String label) {
        if (value == null || value.isBlank() || value.strip().length() > max) error(errors, path, label + " must contain 1 to " + max + " characters");
    }

    private void description(Map<String, List<String>> errors, String path, String value, int max) {
        if (value != null && value.strip().length() > max) error(errors, path, "Description must not exceed " + max + " characters");
    }

    private void error(Map<String, List<String>> errors, String path, String message) { errors.put(path, List.of(message)); }
}
