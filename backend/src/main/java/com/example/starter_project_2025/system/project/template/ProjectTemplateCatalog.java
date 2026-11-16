package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ProjectTemplateCatalog {
    private final JdbcTemplate jdbc;
    private final ProjectTemplateRepository templates;

    public List<String> domains(Long tenantId) {
        return options("DOMAIN", tenantId, templates.findCategories(tenantId)).keySet().stream().sorted().toList();
    }

    public List<ProjectTemplateOptions.Option> levels(Long tenantId) {
        return List.copyOf(options("LEVEL", tenantId, templates.findLevels(tenantId)).values());
    }

    public void validateSelection(Long tenantId, ProjectTemplateRequest request, boolean validateDomain) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        if (validateDomain && !domains(tenantId).contains(request.category().strip())) {
            errors.put("category", List.of("Select an available category"));
        }
        if (levels(tenantId).stream().noneMatch(option -> option.value().equals(request.level().strip()))) {
            errors.put("level", List.of("Select an available level"));
        }
        if (!errors.isEmpty()) {
            throw new ProjectTemplateException(422, "Select available template options", errors);
        }
    }

    private Map<String, ProjectTemplateOptions.Option> options(String kind, Long tenantId, List<String> usedValues) {
        var entries = jdbc.query("""
                SELECT option_value, label
                FROM project_template_catalog
                WHERE option_kind = ? AND tenant_scope_id IN (0, ?)
                ORDER BY tenant_scope_id, sort_order, label, option_value
                """, (row, index) -> new ProjectTemplateOptions.Option(row.getString("option_value"), row.getString("label")),
                kind, tenantId);
        Map<String, ProjectTemplateOptions.Option> options = new LinkedHashMap<>();
        entries.forEach(option -> options.put(option.value(), option));
        usedValues.stream().filter(value -> value != null && !value.isBlank()).map(String::strip).sorted()
                .forEach(value -> options.putIfAbsent(value, new ProjectTemplateOptions.Option(value, value)));
        return options;
    }
}
