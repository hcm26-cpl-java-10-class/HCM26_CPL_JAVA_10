
package com.example.starter_project_2025.system.management.student;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;

import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;

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
        // Kiểm tra mã sinh viên trùng
        if (studentRepository.existsByStudentCode(request.getStudentCode())) {
            ctx.add("studentCode", "Student code already exists");
        }

        // Sinh viên mặc định được kích hoạt
        if (student.getIsActive() == null) {
            student.setIsActive(true);
        }

        // Trạng thái sinh viên mặc định
        if (student.getStatus() == null || student.getStatus().isBlank()) {
            student.setStatus("ACTIVE");
        }

        // Không đặt mật khẩu mặc định cho Student
        student.setPasswordHash(null);
        student.setMustChangePassword(false);

        // Tự động gán Role STUDENT
        Role studentRole = roleRepository.findByName("STUDENT")
                .orElseThrow(() -> new IllegalStateException(
                        "Role STUDENT does not exist"
                ));

        student.getRoles().clear();
        student.getRoles().add(studentRole);
    }

    @Override
    protected void beforeUpdate(
            Student student,
            StudentDTO request,
            ValidationContext ctx
    ) {
        // Kiểm tra mã sinh viên trùng
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
    }
}
