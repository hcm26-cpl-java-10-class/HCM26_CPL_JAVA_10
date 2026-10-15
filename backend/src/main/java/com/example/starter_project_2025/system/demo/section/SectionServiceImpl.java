
package com.example.starter_project_2025.system.demo.section;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.service.BaseCrudServiceImpl;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SectionServiceImpl
        extends BaseCrudServiceImpl<Section, Long, SectionDTO, SectionFilter>
        implements SectionService {

    SectionRepository sectionRepository;
    SectionMapper sectionMapper;
    CourseRepository courseRepository;

    @Override
    protected BaseCrudRepository<Section, Long> getRepository() {
        return sectionRepository;
    }

    @Override
    protected BaseCrudMapper<Section, SectionDTO> getMapper() {
        return sectionMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"title"};
    }

    @Override
    protected void beforeCreate(
            Section section,
            SectionDTO request,
            ValidationContext ctx
    ) {
        Long courseId = request.getCourseId();

        if (courseId == null) {
            ctx.add("courseId", "Course ID is required");
            return;
        }

        Course course = courseRepository.findById(courseId)
                .orElse(null);

        if (course == null) {
            ctx.add("courseId", "Course not found");
            return;
        }

        section.setCourse(course);
        validateFields(request, ctx);
        section.setTitle(request.getTitle());
    }

    @Override
    protected void beforeUpdate(
            Section section,
            SectionDTO request,
            ValidationContext ctx
    ) {
        if (request.getCourseId() != null
                && !request.getCourseId().equals(
                section.getCourse().getId())) {
            ctx.add("courseId", "Cannot change course of a section");
        }

        validateFields(request, ctx);
    }

    private void validateFields(
            SectionDTO request,
            ValidationContext ctx
    ) {
        if (request.getTitle() != null) {
            String title = request.getTitle().trim();
            request.setTitle(title);

            if (title.isEmpty()) {
                ctx.add("title", "Section title must not be blank");
            }
        }

        if (request.getOrderIndex() != null
                && request.getOrderIndex() < 0) {
            ctx.add("orderIndex", "Order index must not be negative");
        }
    }
}
