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
            errors.put("title", List.of("Tên task bắt buộc từ 1 - 250 ký tự"));
        }
        if (request.getProjectId() == null) {
            errors.put("projectId", List.of("Vui lòng chọn Project"));
        }

        Double hours = request.getEstimatedHours();
        if ((request.getAssigneeProjectMemberId() != null && hours == null)
                || (hours != null && (!Double.isFinite(hours) || hours <= 0))) {
            errors.put("estimatedHours", List.of("Estimate phải lớn hơn 0"));
        }
        if (updating && (request.getVersion() == null || request.getVersion() < 0)) {
            errors.put("version", List.of("Vui lòng gửi version hiện tại của Task"));
        }
        if (!updating && request.getStatus() != null && request.getStatus() != TaskStatus.TODO) {
            errors.put("status", List.of("Task mới phải ở trạng thái To Do"));
        }

        Map<String, String> tags = new TreeMap<>();
        if (request.getTags() != null) {
            for (String value : request.getTags()) {
                String name = value == null ? "" : value.strip();
                if (name.isEmpty() || name.length() > 100) {
                    errors.put("tags", List.of("Tag bắt buộc từ 1 - 100 ký tự"));
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
