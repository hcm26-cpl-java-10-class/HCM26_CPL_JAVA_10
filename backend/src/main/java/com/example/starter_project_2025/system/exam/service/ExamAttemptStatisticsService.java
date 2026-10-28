package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptStatisticsDTO;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExamAttemptStatisticsService {

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;

    public List<ExamAttemptStatisticsDTO> getAttempts(Long examId) {
        examRepository.findById(examId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Exam not found"));

        return attemptRepository.findAllByExam_Id(examId)
                .stream()
                .sorted(
                        Comparator.comparing(
                                ExamAttempt::getStartedAt,
                                Comparator.nullsLast(Comparator.naturalOrder())
                        ).reversed()
                )
                .map(this::toDTO)
                .toList();
    }

    private ExamAttemptStatisticsDTO toDTO(ExamAttempt attempt) {
        User student = attempt.getStudent();

        String studentName = "";
        String studentEmail = "";

        if (student != null) {
            String firstName = student.getFirstName() == null
                    ? "" : student.getFirstName().trim();

            String lastName = student.getLastName() == null
                    ? "" : student.getLastName().trim();

            studentName = (firstName + " " + lastName).trim();
            studentEmail = student.getEmail() == null
                    ? "" : student.getEmail();
        }

        return new ExamAttemptStatisticsDTO(
                attempt.getId(),
                student == null ? null : student.getId(),
                studentName,
                studentEmail,
                attempt.getAttemptNumber(),
                attempt.getStartedAt(),
                attempt.getSubmittedAt(),
                attempt.getFinalScore(),
                attempt.getStatus()
        );
    }
}
