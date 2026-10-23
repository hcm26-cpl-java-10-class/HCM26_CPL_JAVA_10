package com.example.starter_project_2025.system.demo.schedule_version;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

public interface ScheduleVersionService
        extends BaseCrudService<Long, ScheduleVersionDTO, ScheduleVersionFilter> {

    ScheduleVersionDTO cloneVersion(Long id, String note);

    ScheduleVersionDTO activateVersion(Long id);
}
