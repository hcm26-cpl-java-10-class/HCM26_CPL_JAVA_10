package com.example.starter_project_2025.system.demo.course_assessment;

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
@RequestMapping("/api/assessments")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Assessment", description = "APIs for managing assessments")
public class AssessmentController
        extends BaseCrudDataIoController<Assessment, Long, AssessmentDTO, AssessmentFilter> {

    AssessmentService bookService;
    AssessmentRepository bookRepository;

    @Override
    protected BaseCrudService<Long, AssessmentDTO, AssessmentFilter> getService() {
        return bookService;
    }

    @Override
    protected BaseCrudRepository<Assessment, Long> getRepository() {
        return bookRepository;
    }

    @Override
    protected Class<Assessment> getEntityClass() {
        return Assessment.class;
    }
}
