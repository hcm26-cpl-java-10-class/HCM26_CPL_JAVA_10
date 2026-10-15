package com.example.starter_project_2025.system.schedule.calendar;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CalendarVersionFilter extends BaseFilter {

    @FilterField(entityField = "calendar.id")
    private Long calendarId;

    @FilterField(entityField = "status")
    private CalendarVersionStatus status;
}
