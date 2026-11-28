package com.example.starter_project_2025.system.demo.coursepolicy;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.coursepolicy.CoursePolicyDTO.CompletionRuleRequest;
import com.example.starter_project_2025.system.demo.coursepolicy.CoursePolicyDTO.CompletionRuleResponse;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.function.BooleanSupplier;

@Service
@RequiredArgsConstructor
public class CourseCompletionRuleService {

    private final CourseCompletionRuleRepository ruleRepository;
    private final CourseRepository courseRepository;

    @Transactional(readOnly = true)
    public CompletionRuleResponse get(Long courseId) {
        return ruleRepository.findByCourse_Id(courseId)
                .map(rule -> new CompletionRuleResponse(rule.getMinLessonPercent(), rule.isRequireAssessmentsPass(), true))
                .orElseGet(() -> new CompletionRuleResponse(
                        CompletionRuleLogic.DEFAULT_MIN_LESSON_PERCENT,
                        CompletionRuleLogic.DEFAULT_REQUIRE_ASSESSMENTS_PASS,
                        false));
    }

    @Transactional
    public CompletionRuleResponse save(Long courseId, CompletionRuleRequest request) {
        var course = courseRepository.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));
        CourseCompletionRule rule = ruleRepository.findByCourse_Id(courseId)
                .orElseGet(() -> CourseCompletionRule.builder().course(course).build());
        rule.setMinLessonPercent(request.minLessonPercent());
        rule.setRequireAssessmentsPass(request.requireAssessmentsPass());
        ruleRepository.save(rule);
        return get(courseId);
    }

    /**
     * Single source of truth for "is this learner done with the course?".
     * The assessment check is lazy so it is only evaluated when the lesson target is already met.
     */
    @Transactional(readOnly = true)
    public boolean isComplete(Long courseId, int activeLessons, int completedActiveLessons,
                              BooleanSupplier assessmentsPassed) {
        CompletionRuleResponse rule = get(courseId);
        if (!CompletionRuleLogic.lessonsDone(activeLessons, completedActiveLessons, rule.minLessonPercent())) {
            return false;
        }
        return !rule.requireAssessmentsPass() || assessmentsPassed.getAsBoolean();
    }
}
