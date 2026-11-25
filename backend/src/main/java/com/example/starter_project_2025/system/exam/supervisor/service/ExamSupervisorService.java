package com.example.starter_project_2025.system.exam.supervisor.service;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.supervisor.dto.SupervisorAttemptDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.starter_project_2025.system.exam.integrity.domain.ExamIntegrityEvent;
import com.example.starter_project_2025.system.exam.integrity.domain.ExamIntegrityEventRepository;
import com.example.starter_project_2025.system.exam.supervisor.dto.SupervisorViolationDTO;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;

import java.util.List;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptStatus;

@Service
@RequiredArgsConstructor
public class ExamSupervisorService {

    private final ExamAttemptRepository examAttemptRepository;

    private final ExamIntegrityEventRepository integrityEventRepository;

    @Transactional(readOnly = true)
    public List<SupervisorAttemptDTO> getActiveAttempts(
            UserPrincipal principal
    ) {
        boolean isAdmin = principal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        boolean isTeacher = principal.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_TEACHER"));

        if (!isAdmin && !isTeacher) {
            throw new AccessDeniedException(
                    "You are not allowed to access Exam Supervisor"
            );
        }

        Long userId = principal.getUser().getId();

        return examAttemptRepository.findSupervisorAttempts(
                ExamAttemptStatus.IN_PROGRESS,
                isAdmin,
                userId
        ).stream().map(attempt -> new SupervisorAttemptDTO(
                attempt.getId(),
                attempt.getExam().getId(),
                attempt.getExam().getTitle(),
                attempt.getStudent().getId(),
                attempt.getStudent().getFullName(),
                attempt.getStudent().getEmail(),
                attempt.getStartedAt(),
                attempt.getDeadlineAt()
        )).toList();
    }

    @Transactional(readOnly = true)
    public List<SupervisorViolationDTO> getActiveViolations(
            UserPrincipal principal
    ) {
        // Lấy các lượt thi mà người đang đăng nhập được phép giám sát.
        // Phương thức này cũng kiểm tra quyền Admin/Teacher.
        List<SupervisorAttemptDTO> activeAttempts =
                getActiveAttempts(principal);

        if (activeAttempts.isEmpty()) {
            return List.of();
        }

        // Lập bản đồ attemptId để lấy thông tin học sinh và bài thi.
        Map<Long, SupervisorAttemptDTO> attemptMap = new HashMap<>();

        for (SupervisorAttemptDTO attempt : activeAttempts) {
            attemptMap.put(attempt.attemptId(), attempt);
        }

        // Chỉ truy vấn vi phạm thuộc các lượt thi được phép giám sát.
        List<ExamIntegrityEvent> events =
                integrityEventRepository
                        .findAllByAttemptIdInOrderByOccurredAtDesc(
                                attemptMap.keySet()
                        );

        List<SupervisorViolationDTO> result = new ArrayList<>();

        for (ExamIntegrityEvent event : events) {
            SupervisorAttemptDTO attempt =
                    attemptMap.get(event.getAttemptId());

            if (attempt == null) {
                continue;
            }

            result.add(new SupervisorViolationDTO(
                    event.getId(),
                    event.getAttemptId(),
                    attempt.studentName(),
                    attempt.examTitle(),
                    event.getType().name(),
                    event.getOccurredAt(),
                    event.getDurationSeconds(),
                    event.getDetail()
            ));
        }

        return result;
    }
}