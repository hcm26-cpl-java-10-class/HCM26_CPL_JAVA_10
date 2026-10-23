package com.example.starter_project_2025.system.project.sprint;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.util.List;

/**
 * Request of the Sprint Planning "Xác nhận gán" action (UFR-PRJ-003-03).
 * <p>
 * {@code taskIds} is the complete, ordered Sprint Backlog: its position in the
 * list is the priority order persisted in {@code Task#sprintOrder}. Items that
 * currently belong to the sprint but are missing from the list are moved back
 * to the product backlog, which keeps the UI revert behaviour atomic (AC02).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SprintBacklogPlanDTO {

    List<Long> taskIds;
}
