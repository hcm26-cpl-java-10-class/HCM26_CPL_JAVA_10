package com.example.starter_project_2025.system.management.student;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/students")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Students", description = "APIs for managing student records")
public class StudentController extends BaseCrudDataIoController<Student, Long, StudentDTO, StudentFilter> {
    StudentService studentService;
    StudentRepository studentRepository;

    @Override
    protected BaseCrudService<Long, StudentDTO, StudentFilter> getService() { return studentService; }

    @Override
    protected BaseCrudRepository<Student, Long> getRepository() { return studentRepository; }

    @Override
    protected Class<Student> getEntityClass() { return Student.class; }
}
