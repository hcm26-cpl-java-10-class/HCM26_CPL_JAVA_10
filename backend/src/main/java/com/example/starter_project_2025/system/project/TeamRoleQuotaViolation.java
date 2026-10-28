package com.example.starter_project_2025.system.project;

/**
 * US-11: one role quota problem found while validating a team role
 * configuration.
 *
 * @param role     role code ({@code PM}, {@code BA}, {@code DEV}, {@code QA})
 * @param reason   {@code MISSING_REQUIRED_ROLE} or {@code ROLE_QUOTA_EXCEEDED}
 * @param required quota bound that was violated
 * @param actual   number of members holding the role in the submitted payload
 */
public record TeamRoleQuotaViolation(
        String role,
        String reason,
        int required,
        int actual
) {

    public static final String MISSING_REQUIRED_ROLE = "MISSING_REQUIRED_ROLE";
    public static final String ROLE_QUOTA_EXCEEDED = "ROLE_QUOTA_EXCEEDED";
}
