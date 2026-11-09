package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
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

    @PostMapping
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_CREATE') "
            + "and hasAuthority('SECTION_CREATE') and hasAuthority('LESSON_CREATE')")
    public ResponseEntity<CourseDTO> create(
            @Validated({OnCreate.class, Default.class}) @RequestBody CourseDTO request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }
}
