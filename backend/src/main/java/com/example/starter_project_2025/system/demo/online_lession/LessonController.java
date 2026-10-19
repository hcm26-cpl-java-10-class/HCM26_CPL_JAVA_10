package com.example.starter_project_2025.system.demo.online_lession;

import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/lessons")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Lesson", description = "APIs for managing online lessons")
public class LessonController
        extends BaseCrudController<Long, LessonDTO, LessonFilter> {

    LessonService lessonService;

    @Override
    protected BaseCrudService<Long, LessonDTO, LessonFilter> getService() {
        return lessonService;
    }

    @Override
    @GetMapping
    @PreAuthorize("hasAuthority('LESSON_READ')")
    public ResponseEntity<Page<LessonDTO>> getAll(
            @PageableDefault Pageable pageable,
            @RequestParam(required = false) String search,
            @ModelAttribute LessonFilter filter
    ) {
        return super.getAll(pageable, search, filter);
    }

    @Override
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('LESSON_READ')")
    public ResponseEntity<LessonDTO> getById(@PathVariable Long id) {
        return super.getById(id);
    }

    @Override
    @PostMapping
    @PreAuthorize("hasAuthority('LESSON_CREATE')")
    public ResponseEntity<LessonDTO> create(
            @Validated(OnCreate.class) @RequestBody LessonDTO request
    ) {
        return super.create(request);
    }

    @Override
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('LESSON_UPDATE')")
    public ResponseEntity<LessonDTO> update(
            @PathVariable Long id,
            @Validated(OnUpdate.class) @RequestBody LessonDTO request
    ) {
        return super.update(id, request);
    }

    @Override
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('LESSON_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return super.delete(id);
    }
}
