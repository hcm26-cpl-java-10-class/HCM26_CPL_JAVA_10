package com.example.starter_project_2025.system.project.aiassistant.dto.response.output;

public record TeamConstraintsOutput(
        int minMembers,
        int maxMembers,
        RoleQuotasOutput roleQuotas,
        boolean allowMultiRole
) {

    public record RoleQuotasOutput(
            int pm,
            int ba,
            int dev,
            int qa
    ) {
    }
}
