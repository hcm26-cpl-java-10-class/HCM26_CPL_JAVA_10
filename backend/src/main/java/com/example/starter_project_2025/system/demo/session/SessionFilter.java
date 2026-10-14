package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.base.crud.spec.FilterOperator;
import com.example.starter_project_2025.system.demo.session.Session;
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
public class SessionFilter extends BaseFilter {

    @FilterField
    Long calendarVersionId;

    @FilterField(entityField = "classId", operator = FilterOperator.EQUAL)
    Long classId;

    @FilterField(entityField = "trainerId", operator = FilterOperator.EQUAL)
    Long trainerId;

    @FilterField(entityField = "topicId", operator = FilterOperator.EQUAL)
    Long topicId;

    @FilterField(entityField = "status", operator = FilterOperator.EQUAL)
    Session.SessionStatus status;

    @FilterField(entityField = "title", operator = FilterOperator.LIKE)
    String title;

    @FilterField(entityField = "location", operator = FilterOperator.LIKE)
    String location;

    @FilterField(entityField = "startTime", operator = FilterOperator.GREATER_OR_EQUAL)
    LocalDateTime fromDate;

    @FilterField(entityField = "endTime", operator = FilterOperator.LESS_OR_EQUAL)
    LocalDateTime toDate;
}
