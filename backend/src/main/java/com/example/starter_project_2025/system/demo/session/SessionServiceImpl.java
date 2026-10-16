package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.demo.session.SessionService;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SessionServiceImpl
        extends BaseCrudServiceImpl<Session, Long, SessionDTO, SessionFilter>
        implements SessionService {

    SessionMapper sessionMapper;
    SessionRepository sessionRepository;

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
        // Cho phép tìm kiếm nhanh theo tiêu đề hoặc phòng học
        return new String[]{"title", "location"};
    }

    @Override
    protected void beforeCreate(Session session, SessionDTO request, ValidationContext ctx) {
        // 1. Kiểm tra thời gian: end_time phải sau start_time (BR-02, FR-CAL-01)
        validateSessionTime(request.getStartTime(), request.getEndTime(), ctx);

        // 2. Mặc định trạng thái khi tạo mới là SCHEDULED
        session.setStatus(Session.SessionStatus.SCHEDULED);
    }

    @Override
    protected void beforeUpdate(Session session, SessionDTO request, ValidationContext ctx) {
        // Không cho phép sửa nếu buổi học đã hoàn thành hoặc đã bị hủy
        if (session.getStatus() == Session.SessionStatus.COMPLETED) {
            ctx.add("status", "Cannot update a completed session");
            return;
        }

        if (session.getStatus() == Session.SessionStatus.CANCELLED) {
            ctx.add("status", "Cannot update a cancelled session");
            return;
        }

        // Lấy thời gian mới (nếu request truyền lên) hoặc giữ nguyên thời gian cũ
        LocalDateTime newStart = request.getStartTime() != null ? request.getStartTime() : session.getStartTime();
        LocalDateTime newEnd = request.getEndTime() != null ? request.getEndTime() : session.getEndTime();

        validateSessionTime(newStart, newEnd, ctx);
    }

    @Override
    public SessionDTO cancelSession(Long id, SessionCancelDTO cancelDTO) {
        // Lấy session từ DB
        Session session = sessionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Session not found with id: " + id));

        // Kiểm tra điều kiện nghiệp vụ: Không hủy buổi học đã hoàn thành
        if (session.getStatus() == Session.SessionStatus.COMPLETED) {
            throw new IllegalStateException("Cannot cancel an already completed session");
        }

        if (session.getStatus() == Session.SessionStatus.CANCELLED) {
            throw new IllegalStateException("Session is already cancelled");
        }

        // Cập nhật trạng thái và lý do hủy (Soft cancel theo BR-03)
        session.setStatus(Session.SessionStatus.CANCELLED);
        session.setCancelReason(cancelDTO.getCancelReason());

        Session updatedSession = sessionRepository.save(session);
        return sessionMapper.toDto(updatedSession);
    }

    /**
     * Validate nghiệp vụ thời gian: End Time phải lớn hơn Start Time
     */
    private void validateSessionTime(LocalDateTime start, LocalDateTime end, ValidationContext ctx) {
        if (start != null && end != null && !end.isAfter(start)) {
            ctx.add("endTime", "End time must be after start time");
        }
    }
}
