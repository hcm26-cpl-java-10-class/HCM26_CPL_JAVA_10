package com.example.starter_project_2025.system.demo.coursepolicy;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.coursepolicy.CoursePolicyDTO.AddPrerequisiteRequest;
import com.example.starter_project_2025.system.demo.coursepolicy.CoursePolicyDTO.CompletionRuleRequest;
import com.example.starter_project_2025.system.demo.coursepolicy.CoursePolicyDTO.CompletionRuleResponse;
import com.example.starter_project_2025.system.demo.coursepolicy.CoursePolicyDTO.PrerequisiteItem;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/courses/{courseId}/policy")
@Tag(name = "Course Policy", description = "Completion rule and prerequisites of a course")
public class CoursePolicyController {

    private final CourseCompletionRuleService ruleService;
    private final CoursePrerequisiteService prerequisiteService;

    @GetMapping("/completion-rule")
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public CompletionRuleResponse getRule(@PathVariable Long courseId) {
        return ruleService.get(courseId);
    }

    @PutMapping("/completion-rule")
    @PreAuthorize("hasAuthority('COURSE_UPDATE')")
    public CompletionRuleResponse saveRule(@PathVariable Long courseId,
                                           @Valid @RequestBody CompletionRuleRequest request) {
        return ruleService.save(courseId, request);
    }

    /** Prerequisites with a per-user "met" flag for the caller. */
    @GetMapping("/prerequisites")
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public List<PrerequisiteItem> prerequisites(@AuthenticationPrincipal UserPrincipal principal,
                                                @PathVariable Long courseId) {
        Long userId = principal == null || principal.getUser() == null ? null : principal.getUser().getId();
        return prerequisiteService.list(courseId, userId);
    }

    @PostMapping("/prerequisites")
    @PreAuthorize("hasAuthority('COURSE_UPDATE')")
    public ResponseEntity<List<PrerequisiteItem>> addPrerequisite(@PathVariable Long courseId,
                                                                  @Valid @RequestBody AddPrerequisiteRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(prerequisiteService.add(courseId, request.prerequisiteCourseId()));
    }

    @DeleteMapping("/prerequisites/{prerequisiteCourseId}")
    @PreAuthorize("hasAuthority('COURSE_UPDATE')")
    public ResponseEntity<Void> removePrerequisite(@PathVariable Long courseId,
                                                   @PathVariable Long prerequisiteCourseId) {
        prerequisiteService.remove(courseId, prerequisiteCourseId);
        return ResponseEntity.noContent().build();
    }
}
