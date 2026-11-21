
package com.example.starter_project_2025.system.management.student;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;

import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;

import com.example.starter_project_2025.system.training.ClassEnrollment;
import com.example.starter_project_2025.system.training.ClassEnrollmentRepository;
import com.example.starter_project_2025.system.training.TrainingClassRepository;
import com.example.starter_project_2025.system.training.entity.TrainingClass;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class StudentServiceImpl
        extends BaseCrudServiceImpl<Student, Long, StudentDTO, StudentFilter>
        implements StudentService {

    StudentMapper studentMapper;
    StudentRepository studentRepository;
    RoleRepository roleRepository;
    UserRepository userRepository;
    TrainingClassRepository trainingClassRepository;
    ClassEnrollmentRepository classEnrollmentRepository;

    @Override
    protected BaseCrudRepository<Student, Long> getRepository() {
        return studentRepository;
    }

    @Override
    protected BaseCrudMapper<Student, StudentDTO> getMapper() {
        return studentMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{
                "studentCode",
                "firstName",
                "lastName",
                "email"
        };
    }

    @Override
    protected void beforeCreate(
            Student student,
            StudentDTO request,
            ValidationContext ctx
    ) {
        // Chuẩn hóa email và kiểm tra email trùng.
        if (request.getEmail() != null) {
            request.setEmail(request.getEmail().trim());
            student.setEmail(request.getEmail());
        }

        validateEmailUnique(request.getEmail(), null, ctx);

        // Kiểm tra mã sinh viên trùng.
        if (request.getStudentCode() != null
                && studentRepository.existsByStudentCode(request.getStudentCode())) {
            ctx.add("studentCode", "Student code already exists");
        }

        // Sinh viên mặc định được kích hoạt.
        if (student.getIsActive() == null) {
            student.setIsActive(true);
        }

        // Trạng thái mặc định.
        if (student.getStatus() == null || student.getStatus().isBlank()) {
            student.setStatus("ACTIVE");
        }

        // Không đặt mật khẩu mặc định.
        student.setPasswordHash(null);
        student.setMustChangePassword(false);

        // Tự động thêm Role STUDENT, không xóa Role khác.
        assignStudentRole(student);
    }

    @Override
    protected void afterCreate(Student student, StudentDTO request) {
        syncTrainingClasses(student, request.getTrainingClassIds());
    }

    @Override
    protected void beforeUpdate(
            Student student,
            StudentDTO request,
            ValidationContext ctx
    ) {
        // Kiểm tra email khi người dùng gửi email mới.
        if (request.getEmail() != null) {
            request.setEmail(request.getEmail().trim());

            validateEmailUnique(
                    request.getEmail(),
                    student.getId(),
                    ctx
            );

            student.setEmail(request.getEmail());
        }

        // Kiểm tra mã sinh viên trùng.
        if (request.getStudentCode() != null
                && !request.getStudentCode().equals(student.getStudentCode())
                && studentRepository.existsByStudentCode(request.getStudentCode())) {

            ctx.add("studentCode", "Student code already exists");
        }

        if (student.getIsActive() == null) {
            student.setIsActive(true);
        }

        if (student.getStatus() == null || student.getStatus().isBlank()) {
            student.setStatus("ACTIVE");
        }

        // Đảm bảo Student luôn có Role STUDENT.
        assignStudentRole(student);
    }

    @Override
    protected void afterUpdate(Student student, StudentDTO request) {
        if (request.getTrainingClassIds() != null) {
            syncTrainingClasses(student, request.getTrainingClassIds());
        }
    }

    /**
     * Kiểm tra email duy nhất trên toàn bộ bảng USERS.
     * Không phân biệt chữ hoa và chữ thường.
     */
    private void validateEmailUnique(
            String email,
            Long currentStudentId,
            ValidationContext ctx
    ) {
        if (email == null || email.isBlank()) {
            return;
        }

        User existing = userRepository
                .findByEmailIgnoreCase(email.trim())
                .orElse(null);

        if (existing != null
                && (currentStudentId == null
                || !existing.getId().equals(currentStudentId))) {

            ctx.add(
                    "email",
                    "Email này đã được sử dụng. Vui lòng nhập email khác."
            );
        }
    }

    /**
     * Thêm Role STUDENT mà không xóa các Role hiện có.
     */
    private void assignStudentRole(Student student) {
        Role studentRole = roleRepository.findByName("STUDENT")
                .orElseThrow(() -> new IllegalStateException(
                        "Role STUDENT does not exist"
                ));

        if (student.getRoles() == null) {
            student.setRoles(new HashSet<>());
        }

        student.getRoles().add(studentRole);
    }

    /**
     * Đồng bộ Training Class vào bảng class_enrollments.
     */
    private void syncTrainingClasses(
            Student student,
            List<Long> requestedIds
    ) {
        List<Long> ids = requestedIds == null
                ? List.of()
                : requestedIds;

        Set<Long> selectedIds = new HashSet<>(ids);

        if (selectedIds.size() != ids.size()) {
            throw new IllegalArgumentException(
                    "Training Class contains duplicated class IDs."
            );
        }

        if (selectedIds.contains(null)) {
            throw new IllegalArgumentException(
                    "Training Class ID is required."
            );
        }

        // Bỏ ghi danh ở các lớp đã bỏ chọn.
        for (ClassEnrollment old :
                classEnrollmentRepository.findByTraineeIdAndIsActiveTrue(
                        student.getId()
                )) {

            if (!selectedIds.contains(old.getTrainingClass().getId())) {
                old.setIsActive(false);
            }
        }

        // Thêm hoặc khôi phục ghi danh ở các lớp được chọn.
        for (Long classId : selectedIds) {

            TrainingClass trainingClass = trainingClassRepository
                    .findByIdAndIsActiveTrue(classId)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Training Class not found: " + classId
                    ));

            ClassEnrollment enrollment = classEnrollmentRepository
                    .findByTrainingClass_IdAndTraineeId(
                            classId,
                            student.getId()
                    )
                    .orElseGet(ClassEnrollment::new);

            boolean alreadyEnrolled =
                    Boolean.TRUE.equals(enrollment.getIsActive());

            String status = trainingClass.getStatus() == null
                    ? ""
                    : trainingClass.getStatus()
                            .trim()
                            .toLowerCase(Locale.ROOT);

            if (!alreadyEnrolled
                    && !Set.of("planning", "assigned", "active")
                            .contains(status)) {

                throw new IllegalArgumentException(
                        "Only planning, assigned or active Training Classes "
                                + "can be newly selected: "
                                + trainingClass.getCode()
                );
            }

            // Kiểm tra số lượng chỗ còn lại.
            boolean needsSeat = !alreadyEnrolled;

            if (needsSeat
                    && classEnrollmentRepository.occupiedSeats(classId)
                    >= trainingClass.getPlannedSize()) {

                throw new IllegalArgumentException(
                        "Training Class is full: "
                                + trainingClass.getCode()
                );
            }

            enrollment.setTrainingClass(trainingClass);
            enrollment.setTraineeId(student.getId());
            enrollment.setStudentId(student.getStudentCode());
            enrollment.setFullName(student.getFullName());
            enrollment.setPersonalEmail(student.getEmail());

            enrollment.setDob(
                    student.getDateOfBirth() == null
                            ? null
                            : student.getDateOfBirth().toString()
            );

            enrollment.setGender(
                    student.getGender() == null
                            ? null
                            : student.getGender().name()
            );

            enrollment.setIsActive(true);
            enrollment.setStatus(ClassEnrollment.Status.ACTIVE);

            classEnrollmentRepository.save(enrollment);
        }

        classEnrollmentRepository.flush();
    }
}
