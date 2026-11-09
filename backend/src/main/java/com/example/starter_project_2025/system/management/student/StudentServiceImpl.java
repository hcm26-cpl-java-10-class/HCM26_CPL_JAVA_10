
package com.example.starter_project_2025.system.management.student;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class StudentServiceImpl extends BaseCrudServiceImpl<Student, Long, StudentDTO, StudentFilter>
        implements StudentService {

    StudentMapper studentMapper;
    StudentRepository studentRepository;

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
        return new String[]{"studentCode", "firstName", "lastName"};
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

        // Mặc định kích hoạt sinh viên
        if (student.getIsActive() == null) {
            student.setIsActive(true);
        }

        // Mặc định lớp
        if (student.getClassName() == null || student.getClassName().isBlank()) {
            student.setClassName("Chưa phân lớp");
        }

        // Mặc định trạng thái
        if (student.getStatus() == null || student.getStatus().isBlank()) {
            student.setStatus("ACTIVE");
        }
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

        // Giữ giá trị mặc định nếu thiếu
        if (student.getIsActive() == null) {
            student.setIsActive(true);
        }

        if (student.getClassName() == null || student.getClassName().isBlank()) {
            student.setClassName("Chưa phân lớp");
        }

        if (student.getStatus() == null || student.getStatus().isBlank()) {
            student.setStatus("ACTIVE");
        }
    }
}
