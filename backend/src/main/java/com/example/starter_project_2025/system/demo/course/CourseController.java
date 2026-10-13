package com.example.starter_project_2025.system.demo.course;

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
@RequestMapping("/api/courses")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Course", description = "APIs for managing courses")
public class CourseController
        extends BaseCrudDataIoController<Course, Long, CourseDTO, CourseFilter> {

    CourseService courseService;
    CourseRepository courseRepository;

    @Override
    protected BaseCrudService<Long, CourseDTO, CourseFilter> getService() {
        return courseService;
    }

    @Override
    protected BaseCrudRepository<Course, Long> getRepository() {
        return courseRepository;
    }

    @Override
    protected Class<Course> getEntityClass() {
        return Course.class;
    }
}
