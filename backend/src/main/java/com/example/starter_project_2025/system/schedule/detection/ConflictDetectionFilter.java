package com.example.starter_project_2025.system.schedule.detection;

import lombok.*;
import lombok.experimental.FieldDefaults;

/** Query criteria scaffold; entity filter mappings will follow the calendar model. */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ConflictDetectionFilter {
    Long calendarVersionId;
}
