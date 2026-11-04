package com.example.starter_project_2025.system.demo.online_lession;

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
public class LessonServiceImpl
        extends BaseCrudServiceImpl<Lesson, Long, LessonDTO, LessonFilter>
        implements LessonService {

    LessonMapper lessonMapper;
    LessonRepository lessonRepository;
    CourseRepository courseRepository;

    @Override
    protected BaseCrudRepository<Lesson, Long> getRepository() {
        return lessonRepository;
    }

    @Override
    protected BaseCrudMapper<Lesson, LessonDTO> getMapper() {
        return lessonMapper;
    }

    @Override
    protected String[] searchableFields() {
        return new String[]{"title", "description"};
    }

    @Override
    protected void beforeCreate(Lesson lesson, LessonDTO request, ValidationContext ctx) {

        Course course = findCourse(request.getCourseId(), ctx);
        if (course == null) {
            return;
        }

        lesson.setCourse(course);

        if (lessonRepository.existsByCourse_IdAndTitleIgnoreCase(course.getId(), request.getTitle())) {
            ctx.add("title", "Lesson title already exists in this course");
        }

        if (lessonRepository.existsByCourse_IdAndOrderIndex(course.getId(), request.getOrderIndex())) {
            ctx.add("orderIndex", "This order is already used in this course");
        }
    }

    @Override
    protected void beforeUpdate(Lesson lesson, LessonDTO request, ValidationContext ctx) {

        Course course = lesson.getCourse();

        if (request.getCourseId() != null && !request.getCourseId().equals(course.getId())) {
            course = findCourse(request.getCourseId(), ctx);
            if (course == null) {
                return;
            }
            lesson.setCourse(course);
        }

        String title = request.getTitle() != null ? request.getTitle() : lesson.getTitle();
        Integer order = request.getOrderIndex() != null ? request.getOrderIndex() : lesson.getOrderIndex();

        if (lessonRepository.existsByCourse_IdAndTitleIgnoreCaseAndIdNot(course.getId(), title, lesson.getId())) {
            ctx.add("title", "Lesson title already exists in this course");
        }

        if (lessonRepository.existsByCourse_IdAndOrderIndexAndIdNot(course.getId(), order, lesson.getId())) {
            ctx.add("orderIndex", "This order is already used in this course");
        }
    }

    private Course findCourse(Long courseId, ValidationContext ctx) {
        if (courseId == null) {
            ctx.add("courseId", "Course is required");
            return null;
        }
        return courseRepository.findById(courseId).orElseGet(() -> {
            ctx.add("courseId", "Course does not exist");
            return null;
        });
    }
}
