package com.example.starter_project_2025.system.project.sprint;

import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Payload of the "confirm assignment" action of the backlog board
 * (UFR-PRJ-003-03).
 * <p>
 * {@link #taskIds} is the complete, ordered list of backlog items the board
 * considers part of the sprint. The name is kept from the original contract
 * (the JSON key is {@code taskIds}) so the UI payload does not change.
 */
@Getter
@Setter
@NoArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SprintBacklogPlanDTO {

    List<Long> taskIds;
}
