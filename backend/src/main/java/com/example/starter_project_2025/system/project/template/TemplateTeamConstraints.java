package com.example.starter_project_2025.system.project.template;

public record TemplateTeamConstraints(
        int minMembers,
        int maxMembers,
        RoleQuotas roleQuotas,
        boolean allowMultiRole
) {
    public record RoleQuotas(int pm, int ba, int dev, int qa) {
    }
}
