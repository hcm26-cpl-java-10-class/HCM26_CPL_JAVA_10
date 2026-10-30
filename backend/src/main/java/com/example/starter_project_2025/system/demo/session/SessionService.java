package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.demo.session.SessionCancelDTO;
import com.example.starter_project_2025.system.demo.session.SessionDTO;
import org.springframework.stereotype.Service;


public interface SessionService extends BaseCrudService<Long, SessionDTO, SessionFilter> {

    SessionDTO cancelSession(Long id, SessionCancelDTO cancelDTO);

    java.util.List<SessionDTO> createValidatedBatch(java.util.List<SessionDTO> requests);
}
