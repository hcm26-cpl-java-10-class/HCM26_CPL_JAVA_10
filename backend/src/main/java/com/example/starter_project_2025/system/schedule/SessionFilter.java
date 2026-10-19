package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionFilter extends BaseFilter {

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

    // Bổ sung thêm bộ lọc khoảng thời gian (Từ ngày -> Đến ngày)
    @FilterField(entityField = "startTime", operator = FilterOperator.GREATER_OR_EQUAL)
    private LocalDateTime fromDate;

    @FilterField(entityField = "endTime", operator = FilterOperator.LESS_OR_EQUAL)
    private LocalDateTime toDate;

    @FilterField(entityField = "calendarVersion.id", operator = FilterOperator.EQUAL)
    private Long calendarVersionId;
}