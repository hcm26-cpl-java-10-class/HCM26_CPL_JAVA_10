package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;

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

    Page<TeachingAssignmentResponse> searchAssignments(Long classId, Long programSubjectId,
                                                         Long trainerId, AssignmentRole role,
                                                         LocalDate effectiveOn, Pageable pageable);

    TeachingAssignmentResponse getAssignment(Long id);

    TeachingAssignmentResponse createAssignment(TeachingAssignmentRequest request);

    TeachingAssignmentResponse updateAssignment(Long id, TeachingAssignmentRequest request);

    void deleteAssignment(Long id);
}
