package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SprintDTO extends BaseDTO {

    Long projectId;

    /**
     * Display-only projection of the linked project name.
     */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    String projectName;

    String name;

    String sprintGoal;

    LocalDateTime startDate;

    LocalDateTime endDate;

    SprintStatus status;

    /**
     * Optimistic locking token, read-only for clients.
     */
    @JsonProperty(access = JsonProperty.Access.READ_ONLY)
    Long version;
}
