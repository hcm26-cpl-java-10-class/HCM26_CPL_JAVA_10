package com.example.starter_project_2025.system.project.task.reminder;
import java.time.Instant;
import java.util.*;
/** UFR Artifact/Commit adapter returns latest real contribution by actor in the requested project.
 * Ingestion must lock the contributing user's row before committing (UserRepository.lockForContribution),
 * so reminders and contributions use the same serialization boundary. Empty results use Task Audit fallback.
 */
public interface MemberContributionPort {
    Map<Long,Instant> latest(UUID projectId,Set<Long> actorIds,Instant now);
}
