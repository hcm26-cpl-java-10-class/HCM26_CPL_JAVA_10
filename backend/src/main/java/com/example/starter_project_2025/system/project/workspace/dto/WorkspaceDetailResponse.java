package com.example.starter_project_2025.system.project;

import lombok.Builder;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.LocalDateTime;
import java.time.Instant;
import java.util.List;

@Data
@Builder
public class WorkspaceDetailResponse {
    private Long id;
    private String code;
    private String name;
    private WorkspaceStatus status;
    private Long projectId;
    private String projectCode;
    private String projectName;
    private String projectDescription;
    private ProjectStatus projectStatus;
    private Long teamId;
    private String teamCode;
    private String teamName;
    private String mentorName;
    private ProjectHubDtos.Charter charter;
    private Long cohortId;
    private String cohortName;
    private LocalDateTime createdAt;
    private String createdByName;
    @JsonProperty("member_count")
    private long memberCount;
    @JsonProperty("can_view_members")
    private boolean canViewMembers;
    @JsonProperty("topic_snapshot")
    private WorkspaceTopicSnapshotResponse topicSnapshot;
    private List<String> sections;
    private List<ActivityItem> activities;

    public record ActivityItem(String eventId, String action, Long actorId, String actorName,
                               Instant occurredAt, String correlationId) { }
}
