package com.example.starter_project_2025.system.project.milestone.integration.mock;

import java.util.UUID;

public final class MockMilestoneData {
    public static final Long PROJECT_ID = 1L;
    public static final Long SECOND_PROJECT_ID = 2L;
    public static final Long OUT_OF_SCOPE_PROJECT_ID = -1L;
    public static final Long TENANT_ID = 1L;
    public static final Long TEAM_ID = 1L;
    public static final UUID RUBRIC_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    public static final UUID PRESENTATION_RUBRIC_ID = UUID.fromString("22222222-2222-2222-2222-222222222223");
    public static final UUID DOCUMENTATION_RUBRIC_ID = UUID.fromString("22222222-2222-2222-2222-222222222224");
    public static final UUID REVIEWER_ID = UUID.fromString("33333333-3333-3333-3333-333333333333");
    public static final UUID SECONDARY_REVIEWER_ID = UUID.fromString("33333333-3333-3333-3333-333333333334");
    public static final UUID TECHNICAL_REVIEWER_ID = UUID.fromString("33333333-3333-3333-3333-333333333335");

    private MockMilestoneData() {
    }
}
