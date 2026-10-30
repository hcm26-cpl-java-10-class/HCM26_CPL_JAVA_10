package com.example.starter_project_2025.system.project.task;

import org.springframework.stereotype.Component;

import java.util.*;

@Component
public class TaskValidator {

    public void normalizeAndValidate(TaskDTO request, boolean updating) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        String title = request.getTitle() == null ? "" : request.getTitle().strip();
        request.setTitle(title);

        if (title.isEmpty() || title.length() > 250) {
            errors.put("title", List.of("Task title must contain 1 to 250 characters"));
        }
        if (request.getProjectId() == null) {
            errors.put("projectId", List.of("Please select a project"));
        }
        String description = request.getDescription();
        if (description != null && !description.isBlank()
                && description.strip().split("\\s+").length > 1000) {
            errors.put("description", List.of("Description must not exceed 1000 words"));
        }

        Double hours = request.getEstimatedHours();
        if ((request.getAssigneeProjectMemberId() != null && hours == null)
                || (hours != null && (!Double.isFinite(hours) || hours <= 0))) {
            errors.put("estimatedHours", List.of("Estimate must be a valid number greater than 0"));
        }
        if (updating && (request.getVersion() == null || request.getVersion() < 0)) {
            errors.put("version", List.of("Please provide the current task version"));
        }
        if (!updating && request.getStatus() != null && request.getStatus() != TaskStatus.TODO) {
            errors.put("status", List.of("New tasks must have To Do status"));
        }

        Map<String, String> tags = new TreeMap<>();
        if (request.getTags() != null) {
            for (String value : request.getTags()) {
                String name = value == null ? "" : value.strip();
                if (name.isEmpty() || name.length() > 100) {
                    errors.put("tags", List.of("Tags must contain 1 to 100 characters"));
                } else {
                    tags.putIfAbsent(name.toLowerCase(Locale.ROOT), name);
                }
            }
        }
        request.setTags(new ArrayList<>(tags.values()));
        if (request.getPriority() == null) {
            request.setPriority(TaskPriority.MEDIUM);
        }
        if (!errors.isEmpty()) {
            throw new TaskValidationException(errors);
        }
    }
}
