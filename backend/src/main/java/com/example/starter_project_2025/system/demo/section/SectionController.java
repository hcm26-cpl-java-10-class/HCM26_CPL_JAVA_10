
package com.example.starter_project_2025.system.demo.section;

import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import org.springframework.http.HttpStatus;
@RestController
@RequestMapping("/api/sections")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Section", description = "APIs for managing sections")
public class SectionController
        extends BaseCrudController<Long, SectionDTO, SectionFilter> {

    SectionService sectionService;

    @Override
    protected BaseCrudService<Long, SectionDTO, SectionFilter> getService() {
        return sectionService;
    }

    @Override
    @GetMapping
    @PreAuthorize("hasAuthority('SECTION_READ')")
    public ResponseEntity<Page<SectionDTO>> getAll(
            @PageableDefault(
                    sort = "orderIndex",
                    direction = Sort.Direction.ASC
            ) Pageable pageable,
            @RequestParam(required = false) String search,
            @ModelAttribute SectionFilter filter
    ) {
        return super.getAll(pageable, search, filter);
    }

    @Override
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('SECTION_READ')")
    public ResponseEntity<SectionDTO> getById(@PathVariable Long id) {
        return super.getById(id);
    }

    @Override
    @PostMapping
    @PreAuthorize("hasAuthority('SECTION_CREATE')")
    public ResponseEntity<SectionDTO> create(
            @Validated(OnCreate.class) @RequestBody SectionDTO request
    ) {
        return super.create(request);
    }

    @Override
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('SECTION_UPDATE')")
    public ResponseEntity<SectionDTO> update(
            @PathVariable Long id,
            @Validated(OnUpdate.class) @RequestBody SectionDTO request
    ) {
        return super.update(id, request);
    }

    @Override
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('SECTION_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return super.delete(id);
    }

    public record BulkSectionRequest(
            Long courseId,
            List<String> titles
    ) {
    }

    @PostMapping("/bulk")
    @PreAuthorize("hasAuthority('SECTION_CREATE')")
    public ResponseEntity<List<SectionDTO>> createBulk(
            @RequestBody BulkSectionRequest request
    ) {
        List<SectionDTO> created = sectionService.createBulk(
                request.courseId(),
                request.titles()
        );

        return ResponseEntity
                .status(HttpStatus.CREATED)
                .body(created);
    }

}
