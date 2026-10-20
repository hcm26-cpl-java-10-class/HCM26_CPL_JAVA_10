package com.example.starter_project_2025.system.schedule.calendar.crud;

import com.example.starter_project_2025.base.crud.dto.BaseFilter;
import com.example.starter_project_2025.base.crud.spec.FilterField;
import lombok.Getter;
import lombok.Setter;
@Getter
@Setter
public class CalendarVersionCrudFilter extends BaseFilter {
    @FilterField
    private Long calendarId;
}
