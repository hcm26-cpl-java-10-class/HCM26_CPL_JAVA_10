package com.example.starter_project_2025.system.schedule_version;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Bộ lọc cho danh sách ScheduleVersion.
 * Dùng cho endpoint GET /api/schedule-versions/classes/{classId}
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ScheduleVersionFilter extends BaseFilter {

    @FilterField(entityField = "classId", operator = FilterOperator.EQUAL)
    String classId;

    @FilterField(entityField = "status", operator = FilterOperator.EQUAL)
    ScheduleVersionStatus status;
}
