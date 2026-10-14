package com.example.starter_project_2025.system.demo.calendar;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.demo.session.SessionDTO;
import java.time.LocalDateTime;
import java.util.List;
public interface CalendarService extends BaseCrudService<Long, CalendarDTO, CalendarFilter> {
    List<SessionDTO> events(Long id, LocalDateTime from, LocalDateTime to);
}
