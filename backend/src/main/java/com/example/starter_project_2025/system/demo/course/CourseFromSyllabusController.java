package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.system.demo.course.CourseFromSyllabusModels.CreateRequest;
import com.example.starter_project_2025.system.demo.course.CourseFromSyllabusModels.Preview;
import com.example.starter_project_2025.system.demo.course.CourseFromSyllabusModels.NameSuggestion;
import com.example.starter_project_2025.system.demo.course.CourseFromSyllabusModels.NameAvailability;
import jakarta.validation.groups.Default;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/courses/from-syllabus")
public class CourseFromSyllabusController {
    private final CourseFromSyllabusService service;

    @GetMapping("/{syllabusId}/preview")
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_CREATE') "
            + "and hasAuthority('SECTION_CREATE') and hasAuthority('LESSON_CREATE')")
    public Preview preview(@PathVariable Long syllabusId) {
        return service.preview(syllabusId);
    }

    /** Name is advisory, not reserved: DB uniqueness still protects concurrent creates. */
    @GetMapping("/{syllabusId}/suggested-name")
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_CREATE')")
    public NameSuggestion suggestName(@PathVariable Long syllabusId,
                                      @RequestParam(defaultValue = "1") int startAt) {
        return service.suggestName(syllabusId, startAt);
    }

    @GetMapping("/{syllabusId}/name-availability")
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_CREATE')")
    public NameAvailability nameAvailability(@PathVariable Long syllabusId,
                                             @RequestParam String name) {
        return service.nameAvailability(syllabusId, name);
    }

    /** New two-table editor: persist exactly the Section/Lesson titles ordered by the user. */
    @PostMapping("/customized")
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_CREATE') "
            + "and hasAuthority('SECTION_CREATE') and hasAuthority('LESSON_CREATE')")
    public ResponseEntity<CourseDTO> createCustomized(@RequestBody CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createCustomized(request));
    }

    /** Legacy endpoint stays compatible with the existing Course creation flow. */
    @PostMapping
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_CREATE') "
            + "and hasAuthority('SECTION_CREATE') and hasAuthority('LESSON_CREATE')")
    public ResponseEntity<CourseDTO> create(
            @Validated({OnCreate.class, Default.class}) @RequestBody CourseDTO request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }
}
