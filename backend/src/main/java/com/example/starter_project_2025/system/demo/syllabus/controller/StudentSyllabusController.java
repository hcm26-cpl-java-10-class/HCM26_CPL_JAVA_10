
package com.example.starter_project_2025.system.demo.syllabus.controller;


import lombok.RequiredArgsConstructor;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.example.starter_project_2025.system.demo.syllabus.service.StudentSyllabusCatalogService;
import com.example.starter_project_2025.system.demo.syllabus.service.StudentSyllabusTranslationService;

@RestController
@RequestMapping("/api/student/syllabuses")
@RequiredArgsConstructor
@PreAuthorize(
        "hasAuthority('COURSE_READ') or " +
                "hasAuthority('SYLLABUS_READ')"
)
public class StudentSyllabusController {

    private final StudentSyllabusCatalogService catalog;
    private final StudentSyllabusTranslationService translator;

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

    /** Translations are read-only, generated on demand and not persisted in H2. */
    @PostMapping("/translations")
    public List<StudentSyllabusCatalogService.Item> translatePage(
            @RequestBody StudentSyllabusTranslationService.IdsRequest request) {
        return translator.translateList(request);
    }

    @PostMapping("/{id}/translation")
    public StudentSyllabusCatalogService.Detail translateDetail(@PathVariable Long id) {
        return translator.translateDetail(id);
    }

    @GetMapping("/{id}/related-courses")
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public List<StudentSyllabusCatalogService.RelatedCourse> relatedCourses(@PathVariable Long id) {
        return catalog.relatedCourses(id);
    }

    @GetMapping("/{id}")
    public StudentSyllabusCatalogService.Detail detail(
            @PathVariable Long id
    ) {
        return catalog.detail(id);
    }
}
