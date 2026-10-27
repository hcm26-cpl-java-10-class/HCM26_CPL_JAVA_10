package com.example.starter_project_2025.system.trainingprogram;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import com.example.starter_project_2025.system.demo.session.Session;

public interface ClassSetupService {
    ClassProgramSubjectsResponse assignProgram(Long classId, Long programId);

    ClassProgramSubjectsResponse getClassProgramSubjects(Long classId);

    List<TeachingAssignmentResponse> getClassAssignments(Long classId);

    List<TeachingAssignmentResponse> getAvailableClassAssignments(Long classId, LocalDate date);

    Page<TeachingAssignmentResponse> searchAssignments(Long classId, Long programSubjectId,
                                                         Long trainerId, AssignmentRole role,
                                                         LocalDate effectiveOn, String search, Long subjectId, Pageable pageable);

    TeachingAssignmentOptions getAssignmentOptions();

    TeachingAssignmentCreateOptions getAssignmentCreateOptions();

    TeachingAssignmentCreateOptions.ClassContext getAssignmentCreateContext(Long classId);

    TeachingAssignmentResponse getAssignment(Long id);

    Page<TeachingAssignmentSessionResponse> getAssignmentSessions(Long id, Session.SessionStatus status, Pageable pageable);

    TeachingAssignmentResponse createAssignment(TeachingAssignmentRequest request);

    TeachingAssignmentResponse updateAssignment(Long id, TeachingAssignmentRequest request);

    TeachingAssignmentEditContext getAssignmentEditContext(Long id);

    TeachingAssignmentImpactResponse previewAssignmentImpact(Long id, TeachingAssignmentRequest request, Pageable pageable);

    void deleteAssignment(Long id);
}
