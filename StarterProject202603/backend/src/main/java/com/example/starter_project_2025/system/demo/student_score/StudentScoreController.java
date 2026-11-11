package com.example.starter_project_2025.system.demo.student_score;

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
@RequestMapping("/api/student-scores")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Student Score", description = "APIs for managing student scores")
public class StudentScoreController
        extends BaseCrudDataIoController<StudentScore, Long, StudentScoreDTO, StudentScoreFilter> {

    StudentScoreService studentScoreService;
    StudentScoreRepository studentScoreRepository;

    @Override
    protected BaseCrudService<Long, StudentScoreDTO, StudentScoreFilter> getService() {
        return studentScoreService;
    }

    @Override
    protected BaseCrudRepository<StudentScore, Long> getRepository() {
        return studentScoreRepository;
    }

    @Override
    protected Class<StudentScore> getEntityClass() {
        return StudentScore.class;
    }
}
