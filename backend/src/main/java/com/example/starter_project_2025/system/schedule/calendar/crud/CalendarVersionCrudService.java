package com.example.starter_project_2025.system.schedule.calendar.crud;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
public interface CalendarVersionCrudService extends BaseCrudService<Long, CalendarVersionDTO, CalendarVersionCrudFilter> {
    CalendarVersionDTO activate(Long id);
    CalendarVersionDTO cloneVersion(Long id);
}
