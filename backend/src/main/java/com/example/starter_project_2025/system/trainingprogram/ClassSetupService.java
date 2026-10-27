package com.example.starter_project_2025.system.trainingprogram;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;

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

    TeachingAssignmentResponse createAssignment(TeachingAssignmentRequest request);

    TeachingAssignmentResponse updateAssignment(Long id, TeachingAssignmentRequest request);

    void deleteAssignment(Long id);
}
