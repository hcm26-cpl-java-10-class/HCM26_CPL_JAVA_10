
package com.example.starter_project_2025.system.demo.syllabus;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/student/syllabuses")
@RequiredArgsConstructor
@PreAuthorize(
        "hasAuthority('COURSE_READ') or " +
                "hasAuthority('SYLLABUS_READ')"
)
public class StudentSyllabusController {

    private final StudentSyllabusCatalogService catalog;

    @GetMapping
    public StudentSyllabusCatalogService.CatalogPage list(
            @RequestParam(defaultValue = "") String search,
            @RequestParam(defaultValue = "all") String searchBy,
            @RequestParam(defaultValue = "name") String sortBy,
            @RequestParam(defaultValue = "0") int page
    ) {
        return catalog.list(
                search,
                searchBy,
                sortBy,
                page
        );
    }

    @GetMapping("/{id}")
    public StudentSyllabusCatalogService.Detail detail(
            @PathVariable Long id
    ) {
        return catalog.detail(id);
    }
}
