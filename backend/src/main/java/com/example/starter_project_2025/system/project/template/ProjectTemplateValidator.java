package com.example.starter_project_2025.system.project.template;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.springframework.stereotype.Component;

@Component
public class ProjectTemplateValidator {
    public void validate(ProjectTemplateRequest request, boolean updating) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        text(errors, "code", request.code(), 100);
        text(errors, "name", request.name(), 255);
        text(errors, "description", request.description(), Integer.MAX_VALUE);
        text(errors, "category", request.category(), 255);
        if (request.level() == null) {
            errors.put("level", List.of("Select Beginner, Intermediate or Advanced"));
        }
        if (!positiveInteger(request.estimatedDurationWeeks())) {
            errors.put("estimatedDurationWeeks", List.of("Estimated duration must be a positive whole number of weeks"));
        }
        if (updating && !validVersion(request.lockVersion())) {
            errors.put("lockVersion", List.of("A valid template revision is required. Please reload the template"));
        }
        if (!errors.isEmpty()) {
            throw new ProjectTemplateException(422, "Please correct the highlighted fields", errors);
        }
    }

    public void validateTeamConstraints(TemplateTeamConstraintsRequest request) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        boolean validMinimum = integer(errors, "minMembers", request.minMembers(), 1,
                "Minimum members must be a positive whole number");
        boolean validMaximum = integer(errors, "maxMembers", request.maxMembers(), 1,
                "Maximum members must be a positive whole number");
        if (validMinimum && validMaximum && request.minMembers().compareTo(request.maxMembers()) > 0) {
            String message = "Minimum members must not exceed maximum members";
            errors.put("minMembers", List.of(message));
            errors.put("maxMembers", List.of(message));
        }

        var quotas = request.roleQuotas();
        if (quotas == null) {
            errors.put("roleQuotas", List.of("Enter the minimum number for PM, BA, DEV and QA"));
        } else {
            integer(errors, "roleQuotas.pm", quotas.pm(), 0, "PM minimum must be a whole number of 0 or greater");
            integer(errors, "roleQuotas.ba", quotas.ba(), 0, "BA minimum must be a whole number of 0 or greater");
            integer(errors, "roleQuotas.dev", quotas.dev(), 0, "DEV minimum must be a whole number of 0 or greater");
            integer(errors, "roleQuotas.qa", quotas.qa(), 0, "QA minimum must be a whole number of 0 or greater");
            boolean validRoles = Stream.of(quotas.pm(), quotas.ba(), quotas.dev(), quotas.qa())
                    .allMatch(this::nonNegativeInteger);
            if (validMaximum && validRoles) {
                long total = quotas.pm().longValueExact() + quotas.ba().longValueExact()
                        + quotas.dev().longValueExact() + quotas.qa().longValueExact();
                if (total > request.maxMembers().intValueExact()) {
                    errors.put("roleQuotas", List.of("Total minimum role quotas must not exceed maximum members"));
                }
            }
        }
        if (request.allowMultiRole() == null) {
            errors.put("allowMultiRole", List.of("Choose whether members can hold multiple roles"));
        }
        if (!validVersion(request.lockVersion())) {
            errors.put("lockVersion", List.of("A valid template revision is required. Please reload the template"));
        }
        if (!errors.isEmpty()) {
            throw new ProjectTemplateException(422, "Please correct the highlighted fields", errors);
        }
    }

    private boolean integer(Map<String, List<String>> errors, String field, BigDecimal value,
            int minimum, String message) {
        boolean valid = minimum == 0 ? nonNegativeInteger(value) : positiveInteger(value);
        if (!valid) errors.put(field, List.of(message));
        return valid;
    }

    private boolean nonNegativeInteger(BigDecimal value) {
        try {
            return value != null && value.intValueExact() >= 0;
        } catch (ArithmeticException exception) {
            return false;
        }
    }

    private void text(Map<String, List<String>> errors, String field, String value, int maxLength) {
        String label = Character.toUpperCase(field.charAt(0)) + field.substring(1);
        if (value == null || value.isBlank()) {
            errors.put(field, List.of(label + " is required"));
        } else if (value.strip().length() > maxLength) {
            errors.put(field, List.of(label + " must not exceed " + maxLength + " characters"));
        }
    }

    private boolean positiveInteger(BigDecimal value) {
        try {
            return value != null && value.intValueExact() > 0;
        } catch (ArithmeticException exception) {
            return false;
        }
    }

    private boolean validVersion(BigDecimal value) {
        try {
            return value != null && value.longValueExact() >= 0;
        } catch (ArithmeticException exception) {
            return false;
        }
    }
}
