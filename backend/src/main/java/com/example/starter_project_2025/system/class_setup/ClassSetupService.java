package com.example.starter_project_2025.system.class_setup;

import com.example.starter_project_2025.system.class_setup.dto.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDate;
import java.util.List;

public interface ClassSetupService {

    // 1. Gán chương trình đào tạo cho lớp
    TrainingClassResponse assignTrainingProgram(Long classId, Long programId);

    // 2. Hiển thị môn học của lớp kèm giảng viên đã phân công
    List<ClassProgramSubjectResponse> getClassProgramSubjects(Long classId);

    // 3. Lấy danh sách phân công giảng viên của lớp
    List<TeachingAssignmentResponse> getClassTeachingAssignments(
            Long classId,
            Long programSubjectId,
            Long trainerId,
            AssignmentRole role,
            Boolean activeOnly
    );

    // 4. Gán giảng viên chính/phụ cho môn của lớp
    TeachingAssignmentResponse createTeachingAssignment(TeachingAssignmentRequest request);

    // 5. Cập nhật phân công giảng dạy
    TeachingAssignmentResponse updateTeachingAssignment(Long id, UpdateTeachingAssignmentRequest request);

    // 6. Bỏ / Ngừng phân công giảng dạy
    void deleteTeachingAssignment(Long id);

    // 7. Bàn giao cho Danh: Phân công còn hiệu lực tại một ngày
    List<AvailableAssignmentResponse> getAvailableAssignments(Long classId, LocalDate date);

    // 8. Bàn giao cho Tân: Lịch giảng dạy theo giảng viên
    List<TeachingAssignmentResponse> getAssignmentsByTrainer(Long trainerId);

    // 9. Quản lý Lớp học (CRUD)
    Page<TrainingClassResponse> searchClasses(String keyword, ClassStatus status, Pageable pageable);
    TrainingClassResponse getClassById(Long id);
    TrainingClassResponse createClass(TrainingClassRequest request);
    TrainingClassResponse updateClass(Long id, TrainingClassRequest request);

    // 10. Ghi danh học viên (Enrollment)
    List<EnrollmentResponse> getEnrollmentsByClassId(Long classId);
    EnrollmentResponse enrollStudent(Long classId, EnrollmentRequest request);
}
