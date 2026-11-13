package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.service.ExamServiceImpl;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequiredArgsConstructor
@RequestMapping("/api/lessons")
public class AssessmentLessonController {
    private final LessonService lessons;
    private final ExamServiceImpl exams;
    private final SectionRepository sections;
    public record Request(@NotNull(groups=OnCreate.class) @Valid LessonDTO lesson,
                          @NotNull(groups=OnCreate.class) @Valid ExamDTO assessment) {}
    public record Result(LessonDTO lesson,ExamDTO assessment) {}

    /** Both creations commit together; a failed assessment must not leave an orphan lesson. */
    @PostMapping("/with-assessment")
    @PreAuthorize("hasAuthority('LESSON_CREATE') and hasAuthority('EXAM_CREATE')")
    @Transactional
    public Result create(@Validated(OnCreate.class) @RequestBody Request request) {
        LessonDTO lesson=request.lesson();
        ExamDTO exam=request.assessment();
        boolean matches=lesson.getContentType()!=null && switch(lesson.getContentType()) {
            case QUIZ -> exam.getCategory()==ExamCategory.QUIZ;
            case ASSIGNMENT -> exam.getCategory()==ExamCategory.ASSIGNMENT;
            case EXAM -> exam.getCategory()==ExamCategory.MIDTERM || exam.getCategory()==ExamCategory.FINAL_TEST;
            default -> false;
        };
        if (!matches) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Assessment category must match the lesson type");
        var section=sections.findById(lesson.getSectionId())
                .orElseThrow(()->new ResourceNotFoundException("Section not found"));
        if (exam.getDurationMinutes()>Integer.MAX_VALUE/60)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Assessment duration is too large");
        lesson.setTitle(exam.getTitle());
        lesson.setDuration(exam.getDurationMinutes()*60);
        lesson.setId(null);
        LessonDTO saved=lessons.create(lesson);
        exam.setId(null);
        exam.setCourseId(section.getCourse().getId());
        exam.setSectionId(section.getId());
        exam.setLessonId(saved.getId());
        return new Result(saved,exams.create(exam));
    }
}
