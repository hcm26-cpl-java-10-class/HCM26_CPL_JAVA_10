package com.example.starter_project_2025.system.git_integration.contributor;

/**
 * GI-06: a contributor of a master project was mapped, unmapped or reassigned. Published inside
 * the writing transaction; a future report cache of the master listens AFTER_COMMIT to evict
 * itself (statistics are computed when read today, so nothing has to be recomputed).
 */
public record GitContributorMappingChangedEvent(Long tenantId, Long masterProjectId) {
}
