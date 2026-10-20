package com.example.starter_project_2025.system.schedule.session;

import java.time.LocalDateTime;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionFilter extends BaseFilter {

    @FilterField(entityField = "calendarVersion.calendar.classId", operator = FilterOperator.EQUAL)
    private Long classId;

    @FilterField(operator = FilterOperator.EQUAL)
    private Long topicId;

    @FilterField(operator = FilterOperator.LIKE)
    private String title;

    @FilterField(entityField = "room", operator = FilterOperator.LIKE)
    private String location;

    @FilterField(entityField = "startTime", operator = FilterOperator.GREATER_OR_EQUAL)
    private LocalDateTime fromDate;

    @FilterField(entityField = "endTime", operator = FilterOperator.LESS_OR_EQUAL)
    private LocalDateTime toDate;

    @FilterField(operator = FilterOperator.LIKE, ignoreCase = true)
    private String classCode;

    @FilterField(operator = FilterOperator.LIKE, ignoreCase = true)
    private String topicName;

    @FilterField(operator = FilterOperator.EQUAL)
    private Long trainerId;

    @FilterField(operator = FilterOperator.EQUAL)
    private SessionStatus status;

    @FilterField(operator = FilterOperator.LIKE, ignoreCase = true)
    private String room;

    @FilterField(entityField = "calendarVersion.id", operator = FilterOperator.EQUAL)
    private Long calendarVersionId;
}
