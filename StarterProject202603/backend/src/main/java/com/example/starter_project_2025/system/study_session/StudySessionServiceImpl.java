package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.academic.subject.Subject;
import com.example.starter_project_2025.system.academic.subject.SubjectRepository;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.AccessDeniedException;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class StudySessionServiceImpl
        extends BaseCrudServiceImpl<StudySession, Long, StudySessionDTO, StudySessionFilter>
        implements StudySessionService {

    StudySessionMapper studySessionMapper;
    StudySessionRepository studySessionRepository;
    SubjectRepository subjectRepository;
    StudySessionVersionLock studySessionVersionLock;
    ApplicationEventPublisher eventPublisher;
    StudySessionValidator studySessionValidator;

    @Override
    @Transactional(readOnly = true)
    public StudySessionStatistics statistics(Long subjectId, java.time.LocalDate dateFrom, java.time.LocalDate dateTo) {
        check("STUDY_SESSION_READ");
        ValidationContext ctx = new ValidationContext();
        if (subjectId != null && subjectId <= 0) ctx.add("subjectId", "Subject ID must be positive");
        if (dateFrom != null && dateTo != null && dateFrom.isAfter(dateTo)) {
            ctx.add("sessionDateTo", "End date must be on or after start date");
        }
        ctx.throwIfErrors();
        long scheduled = 0, completed = 0, cancelled = 0;
        for (var row : studySessionRepository.countByStatus(subjectId, dateFrom, dateTo)) {
            switch (row.getStatus()) {
                case SCHEDULED -> scheduled = row.getCount();
                case COMPLETED -> completed = row.getCount();
                case CANCELLED -> cancelled = row.getCount();
            }
        }
        return StudySessionStatistics.of(scheduled, completed, cancelled);
    }

    @Override
    protected BaseCrudRepository<StudySession, Long> getRepository() {
        return studySessionRepository;
    }

    @Override
    protected BaseCrudMapper<StudySession, StudySessionDTO> getMapper() {
        return studySessionMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"title", "room", "lecturer"};
    }

    @Override
    protected void beforeCreate(StudySession studySession, StudySessionDTO request, ValidationContext ctx) {
        studySessionValidator.validate(request, ctx);
        assignSubject(studySession, request.getSubjectId(), ctx);
    }

    @Override
    protected void beforeUpdate(StudySession studySession, StudySessionDTO request, ValidationContext ctx) {
        if (studySessionVersionLock.isLocked(studySession.getId())) {
            throw new AccessDeniedException("Study session is locked for editing");
        }
        if (studySession.getStatus() != SessionStatus.SCHEDULED) {
            throw new ConflictException("Only scheduled study sessions can be edited");
        }

        studySessionValidator.validateUpdate(studySession, request, ctx);

        if (request.getSubjectId() != null) {
            assignSubject(studySession, request.getSubjectId(), ctx);
        }
    }

    @Override
    public StudySessionDTO updateStatus(Long id, Boolean isActive) {
        check("STUDY_SESSION_UPDATE");
        if (isActive == null) {
            throw new BadRequestException("isActive is required");
        }

        StudySession studySession = studySessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Study session not found"));
        studySession.setIsActive(isActive);
        return studySessionMapper.toResponse(studySessionRepository.save(studySession));
    }

    @Override
    public StudySessionDTO cancel(Long id, CancelSessionRequest request) {
        check("STUDY_SESSION_UPDATE");
        StudySession studySession = studySessionRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Study session not found"));

        if (studySessionVersionLock.isLocked(id)) {
            throw new AccessDeniedException("Study session is locked for editing");
        }

        String reason = request == null || request.getReason() == null
                ? null
                : request.getReason().trim();
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("Cancellation reason is required");
        }
        if (reason.length() > 500) {
            throw new BadRequestException("Cancellation reason must not exceed 500 characters");
        }

        if (studySession.getStatus() != SessionStatus.SCHEDULED) {
            throw new ConflictException("Only scheduled study sessions can be cancelled");
        }

        studySession.setStatus(SessionStatus.CANCELLED);
        studySession.setCancelReason(reason);
        StudySession saved = studySessionRepository.save(studySession);
        eventPublisher.publishEvent(new StudySessionChangedEvent(saved.getId(), saved.getStatus()));
        return studySessionMapper.toResponse(saved);
    }

    @Override
    public StudySessionDTO complete(Long id, CompleteSessionRequest request) {
        check("STUDY_SESSION_UPDATE");
        StudySession studySession = studySessionRepository.findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Study session not found"));

        if (studySessionVersionLock.isLocked(id)) {
            throw new AccessDeniedException(
                    "Study session is locked for editing"
            );
        }
        if (studySession.getStatus() != SessionStatus.SCHEDULED) {
            throw new ConflictException(
                    "Only scheduled study sessions can be completed"
            );
        }

        if (request != null && request.getNotes() != null) {
            studySession.setNotes(request.getNotes().trim());
        }
        studySession.setStatus(SessionStatus.COMPLETED);
        StudySession saved = studySessionRepository.save(studySession);
        eventPublisher.publishEvent(
                new StudySessionChangedEvent(saved.getId(), saved.getStatus())
        );
        return studySessionMapper.toResponse(saved);
    }

    private void assignSubject(StudySession studySession, Long subjectId, ValidationContext ctx) {
        if (subjectId == null) {
            return;
        }

        Subject subject = subjectRepository.findById(subjectId).orElse(null);
        if (subject == null) {
            ctx.add("subjectId", "Subject does not exist");
            return;
        }

        studySession.setSubject(subject);
    }
}
