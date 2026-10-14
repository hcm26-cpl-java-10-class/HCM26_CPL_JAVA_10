package com.example.starter_project_2025.system.demo.calendar_version;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
public interface CalendarVersionService extends BaseCrudService<Long, CalendarVersionDTO, CalendarVersionFilter> {
    CalendarVersionDTO activate(Long id);
    CalendarVersionDTO cloneVersion(Long id);
}
