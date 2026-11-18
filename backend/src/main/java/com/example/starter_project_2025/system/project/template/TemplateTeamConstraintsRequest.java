package com.example.starter_project_2025.system.project.template;

import java.math.BigDecimal;

public record TemplateTeamConstraintsRequest(
        BigDecimal minMembers,
        BigDecimal maxMembers,
        RoleQuotas roleQuotas,
        Boolean allowMultiRole,
        BigDecimal lockVersion
) {
    public record RoleQuotas(BigDecimal pm, BigDecimal ba, BigDecimal dev, BigDecimal qa) {
    }
}
