package com.example.starter_project_2025.system.project.alert;
import java.time.Instant;
import java.util.*;
/** Artifact/commit integrations supply actor contributions, never assignee activity or page views. */
public interface AlertExternalContributions {
    Map<Long,Instant> latest(Long teamId,Long projectId,Set<Long> actorIds,Instant now);
}
