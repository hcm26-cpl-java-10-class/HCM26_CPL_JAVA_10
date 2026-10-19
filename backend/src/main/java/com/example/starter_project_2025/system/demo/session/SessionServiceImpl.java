package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.schedule_validation.ScheduleValidationService;
import com.example.starter_project_2025.system.schedule_validation.SessionConflictCandidate;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SessionServiceImpl
        extends BaseCrudServiceImpl<Session, Long, SessionDTO, SessionFilter>
        implements SessionService {

    SessionMapper sessionMapper;
    SessionRepository sessionRepository;
    ScheduleValidationService scheduleValidationService;

    @Override
    protected BaseCrudRepository<Session, Long> getRepository() {
        return sessionRepository;
    }

    @Override
    protected BaseCrudMapper<Session, SessionDTO> getMapper() {
        return sessionMapper;
    }

    @Override
    protected String[] searchableFields() {
        // Cho phep tim kiem nhanh theo tieu de hoac phong hoc
        return new String[]{"title", "location"};
    }

    @Override
    protected void beforeCreate(Session session, SessionDTO request, ValidationContext ctx) {
        // Kiem tra thoi gian: end_time phai sau start_time
        scheduleValidationService.addValidationErrors(SessionConflictCandidate.from(session), ctx);

        // Mac dinh trang thai khi tao moi la SCHEDULED
        session.setStatus(Session.SessionStatus.SCHEDULED);
    }

    @Override
    protected void beforeUpdate(Session session, SessionDTO request, ValidationContext ctx) {
        // Khong cho phep sua neu buoi hoc da hoan thanh hoac da bi huy
        if (session.getStatus() == Session.SessionStatus.COMPLETED) {
            ctx.add("status", "Cannot update a completed session");
            return;
        }

        if (session.getStatus() == Session.SessionStatus.CANCELLED) {
            ctx.add("status", "Cannot update a cancelled session");
            return;
        }

        // Lay thoi gian moi neu request truyen len, neu khong thi giu gia tri cu
        scheduleValidationService.addValidationErrors(candidateForUpdate(session, request), ctx);
    }

    @Override
    public SessionDTO cancelSession(Long id, SessionCancelDTO cancelDTO) {
        // Lay session tu DB
        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found with id: " + id));

        // Khong huy buoi hoc da hoan thanh
        if (session.getStatus() == Session.SessionStatus.COMPLETED) {
            throw new IllegalStateException("Cannot cancel an already completed session");
        }

        if (session.getStatus() == Session.SessionStatus.CANCELLED) {
            throw new IllegalStateException("Session is already cancelled");
        }

        // Cap nhat trang thai va ly do huy
        session.setStatus(Session.SessionStatus.CANCELLED);
        session.setCancelReason(cancelDTO.getCancelReason());

        Session updatedSession = sessionRepository.save(session);
        return sessionMapper.toDto(updatedSession);
    }

    // Tao du lieu kiem tra bang cach ket hop request voi gia tri hien tai.
    private SessionConflictCandidate candidateForUpdate(Session session, SessionDTO request) {
        return SessionConflictCandidate.builder()
                .sessionId(session.getId())
                .classId(request.getClassId() != null ? request.getClassId() : session.getClassId())
                .trainerId(request.getTrainerId() != null ? request.getTrainerId() : session.getTrainerId())
                .location(request.getLocation() != null ? request.getLocation() : session.getLocation())
                .startTime(request.getStartTime() != null ? request.getStartTime() : session.getStartTime())
                .endTime(request.getEndTime() != null ? request.getEndTime() : session.getEndTime())
                .build();
    }
}
