package com.example.starter_project_2025.system.demo.course;

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
public class CourseServiceImpl
        extends BaseCrudServiceImpl<Course, Long, CourseDTO, CourseFilter>
        implements CourseService {

    CourseMapper courseMapper;
    CourseRepository courseRepository;
    com.example.starter_project_2025.system.demo.category.CategoryRepository categoryRepository;

    private void resolveMetadata(Course course, CourseDTO request) {
        if(request.getCategory() != null){
            java.util.Set<com.example.starter_project_2025.system.demo.category.Category> categories = new java.util.HashSet<>();
            for(String token : request.getCategory().split("[,;|]")){
                String code = token.trim();
                if(!code.isEmpty()) {
                    categories.add(categoryRepository.findByCodeIgnoreCase(code).orElseGet(() -> categoryRepository.save(com.example.starter_project_2025.system.demo.category.Category.builder().code(code).name(code).isActive(true).build())));
                }
            }
            course.setCategories(categories);
        }
    }

    @Override
    protected BaseCrudRepository<Course, Long> getRepository() {
        return courseRepository;
    }

    @Override
    protected BaseCrudMapper<Course, CourseDTO> getMapper() {
        return courseMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"code", "name", "description", "instructor"};
    }

    @Override
    protected void beforeCreate(Course course, CourseDTO request, ValidationContext ctx) {
        resolveMetadata(course, request);
        if (courseRepository.existsByName(request.getName())) {
            ctx.add("name", "Course name already exists");
        }
        if (request.getCode() != null && !request.getCode().isBlank()
                && courseRepository.existsByCode(request.getCode().trim())) {
            ctx.add("code", "Course code already exists");
        }
    }

    @Override
    protected void beforeUpdate(Course course, CourseDTO request, ValidationContext ctx) {
        resolveMetadata(course, request);
        if (request.getName() != null &&
                !request.getName().equals(course.getName()) &&
                courseRepository.existsByName(request.getName())) {
            ctx.add("name", "Course name already exists");
        }
        if (request.getCode() != null && !request.getCode().isBlank()
                && !request.getCode().trim().equalsIgnoreCase(course.getCode() == null ? "" : course.getCode())
                && courseRepository.existsByCode(request.getCode().trim())) {
            ctx.add("code", "Course code already exists");
        }
    }
}