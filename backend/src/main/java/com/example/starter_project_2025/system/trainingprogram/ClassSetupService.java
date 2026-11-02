package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;
import com.example.starter_project_2025.system.demo.session.Session;

public interface ClassSetupService {
    List<ClassSetupOverviewResponse> getSetupOverview();

    ExternalClassDTO createClass(ExternalClassRequest request);

    ExternalClassDTO updateClass(Long classId, ExternalClassRequest request);

    void deleteClass(Long classId);

    ClassProgramSubjectsResponse assignProgram(Long classId, Long programId);

    ClassProgramSubjectsResponse removeProgram(Long classId);

    ClassProgramSubjectsResponse getClassProgramSubjects(Long classId);

    ClassTopicCoursesSaveResponse saveTopicCourses(Long classId, ClassTopicCourseSaveRequest request);

    ClassTopicCoursesSaveResponse saveSingleTopicCourse(Long classId, Long programSubjectId, Long courseId);

    ClassPlanSummaryResponse getPlanSummary(Long classId);

    List<ClassSubjectOptionResponse> getSubjectOptions(Long classId);

    List<TeachingAssignmentResponse> getClassAssignments(Long classId);

    List<TeachingAssignmentResponse> getAvailableClassAssignments(Long classId, LocalDate date);

    List<TeachingAssignmentResponse> getAvailableClassAssignments(Long classId, LocalDate date, Long programSubjectId,
            java.time.LocalDateTime from, java.time.LocalDateTime to);
    record SchedulingDirectory(com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO classProfile,
                               List<TeachingAssignmentResponse> assignments) {}
    SchedulingDirectory getSchedulingDirectory(Long classId);

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

    TeachingAssignmentLifecycleContext getAssignmentLifecycleContext(Long id);

    TeachingAssignmentImpactResponse previewAssignmentEnd(Long id, TeachingAssignmentEndRequest request, Pageable pageable);

    TeachingAssignmentResponse endAssignment(Long id, TeachingAssignmentEndRequest request);

    void deleteAssignment(Long id, Long revision);
}
