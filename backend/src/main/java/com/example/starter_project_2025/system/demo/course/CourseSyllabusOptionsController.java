package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.syllabus.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.SyllabusStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;

@RestController
@RequestMapping("/api/course-syllabus-options")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('COURSE_READ') and (hasAuthority('COURSE_CREATE') or hasAuthority('COURSE_UPDATE'))")
public class CourseSyllabusOptionsController {

    private final SyllabusRepository syllabuses;

    public record Option(Long id, String code, String name) {}

    @GetMapping
    public Page<Option> search(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        String q = search == null ? "" : search.strip().toLowerCase(Locale.ROOT);
        if (q.length() > 100) q = q.substring(0, 100);
        var pageable = PageRequest.of(Math.max(page, 0),
                Math.min(Math.max(size, 1), 30), Sort.by("name").ascending());
        return syllabuses.searchPublished(SyllabusStatus.PUBLISHED,
                        q, "all", "%" + q + "%", pageable)
                .map(this::toOption);
    }

    @GetMapping("/{id}")
    public Option get(@PathVariable Long id) {
        Syllabus syllabus = syllabuses.findById(id)
                .filter(s -> s.getStatus() == SyllabusStatus.PUBLISHED
                        && Boolean.TRUE.equals(s.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Syllabus not available"));
        return toOption(syllabus);
    }

    private Option toOption(Syllabus s) {
        return new Option(s.getId(), s.getCode(), s.getName());
    }
}
