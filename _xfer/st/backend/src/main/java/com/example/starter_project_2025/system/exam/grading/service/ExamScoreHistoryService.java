package com.example.starter_project_2025.system.exam.grading.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.core.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.grading.domain.ExamScoreAdjustment;
import com.example.starter_project_2025.system.exam.grading.domain.ExamScoreAdjustmentRepository;
import com.example.starter_project_2025.system.exam.grading.dto.ScoreAdjustmentHistoryDTO;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Read-only audit trail of manual score edits for one exam, newest first. */
@Service
@RequiredArgsConstructor
public class ExamScoreHistoryService {

    private final ExamRepository examRepository;
    private final ExamScoreAdjustmentRepository adjustmentRepository;
    private final ExamAttemptRepository attemptRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<ScoreAdjustmentHistoryDTO> history(Long examId) {
        if (!examRepository.existsById(examId)) {
            throw new ResourceNotFoundException("Exam not found");
        }
        List<ExamScoreAdjustment> rows = adjustmentRepository.findAllByExamIdOrderByAdjustedAtDesc(examId);
        if (rows.isEmpty()) {
            return List.of();
        }

        Map<Long, ExamAttempt> attempts = new HashMap<>();
        for (ExamAttempt a : attemptRepository.findAllByExam_Id(examId)) {
            attempts.put(a.getId(), a);
        }
        Set<Long> editorIds = new HashSet<>();
        rows.forEach(r -> {
            if (r.getAdjustedBy() != null) editorIds.add(r.getAdjustedBy());
        });
        Map<Long, User> editors = new HashMap<>();
        userRepository.findAllById(editorIds).forEach(u -> editors.put(u.getId(), u));

        return rows.stream().map(r -> {
            ExamAttempt attempt = attempts.get(r.getAttemptId());
            return new ScoreAdjustmentHistoryDTO(r.getId(), r.getAttemptId(),
                    attempt == null ? null : attempt.getAttemptNumber(),
                    attempt == null ? null : displayName(attempt.getStudent()),
                    r.getOldScore(), r.getNewScore(), r.getReason(),
                    r.getAdjustedBy(), displayName(editors.get(r.getAdjustedBy())), r.getAdjustedAt());
        }).toList();
    }

    private static String displayName(User user) {
        if (user == null) {
            return null;
        }
        String first = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String last = user.getLastName() == null ? "" : user.getLastName().trim();
        String name = (first + " " + last).trim();
        return name.isEmpty() ? user.getEmail() : name;
    }
}
