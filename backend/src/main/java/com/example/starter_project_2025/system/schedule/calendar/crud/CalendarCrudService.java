package com.example.starter_project_2025.system.schedule.calendar.crud;

import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;

import java.time.LocalDateTime;
import java.util.List;
public interface CalendarCrudService extends BaseCrudService<Long, CalendarDTO, CalendarFilter> {
    List<SessionDTO> events(Long id, LocalDateTime from, LocalDateTime to);
}
