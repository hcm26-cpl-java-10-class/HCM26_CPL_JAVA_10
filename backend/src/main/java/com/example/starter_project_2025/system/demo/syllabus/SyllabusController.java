package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.system.demo.syllabus.SyllabusModels.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/syllabuses")
@RequiredArgsConstructor
public class SyllabusController {

    private final SyllabusService service;

    @GetMapping
    @PreAuthorize("hasAuthority('SYLLABUS_READ')")
    public List<Summary> list(
            @RequestParam(defaultValue = "") String search
    ) {
        return service.list(search);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('SYLLABUS_READ')")
    public Detail detail(@PathVariable Long id) {
        return service.get(id);
    }

    @GetMapping("/{id}/validate")
    @PreAuthorize("hasAuthority('SYLLABUS_READ')")
    public ValidationResult validate(@PathVariable Long id) {
        return service.validate(id);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('SYLLABUS_CREATE')")
    public Detail create(@RequestBody SyllabusInput input) {
        return service.create(input);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('SYLLABUS_UPDATE')")
    public Detail update(
            @PathVariable Long id,
            @RequestBody SyllabusInput input
    ) {
        return service.update(id, input);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('SYLLABUS_DELETE')")
    public ResponseEntity<Void> delete(
            @PathVariable Long id
    ) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/sections")
    @PreAuthorize("hasAuthority('SYLLABUS_CREATE')")
    public Detail addSection(
            @PathVariable Long id,
            @RequestBody SectionInput input
    ) {
        return service.createSection(id, input);
    }

    @PostMapping("/{id}/sections/bulk")
    @PreAuthorize("hasAuthority('SYLLABUS_CREATE')")
    public Detail bulk(
            @PathVariable Long id,
            @RequestBody BulkSectionInput input
    ) {
        return service.bulkCreateSections(id, input);
    }

    @PutMapping("/{id}/sections/{sectionId}")
    @PreAuthorize("hasAuthority('SYLLABUS_UPDATE')")
    public Detail editSection(
            @PathVariable Long id,
            @PathVariable Long sectionId,
            @RequestBody SectionInput input
    ) {
        return service.updateSection(id, sectionId, input);
    }

    @DeleteMapping("/{id}/sections/{sectionId}")
    @PreAuthorize("hasAuthority('SYLLABUS_DELETE')")
    public ResponseEntity<Void> deleteSection(
            @PathVariable Long id,
            @PathVariable Long sectionId
    ) {
        service.deleteSection(id, sectionId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/sections/{sectionId}/topics")
    @PreAuthorize("hasAuthority('SYLLABUS_CREATE')")
    public Detail addTopic(
            @PathVariable Long id,
            @PathVariable Long sectionId,
            @RequestBody TopicInput input
    ) {
        return service.createTopic(id, sectionId, input);
    }

    @PutMapping("/{id}/sections/{sectionId}/topics/{topicId}")
    @PreAuthorize("hasAuthority('SYLLABUS_UPDATE')")
    public Detail editTopic(
            @PathVariable Long id,
            @PathVariable Long sectionId,
            @PathVariable Long topicId,
            @RequestBody TopicInput input
    ) {
        return service.updateTopic(
                id,
                sectionId,
                topicId,
                input
        );
    }

    @DeleteMapping("/{id}/sections/{sectionId}/topics/{topicId}")
    @PreAuthorize("hasAuthority('SYLLABUS_DELETE')")
    public ResponseEntity<Void> deleteTopic(
            @PathVariable Long id,
            @PathVariable Long sectionId,
            @PathVariable Long topicId
    ) {
        service.deleteTopic(id, sectionId, topicId);
        return ResponseEntity.noContent().build();
    }
}