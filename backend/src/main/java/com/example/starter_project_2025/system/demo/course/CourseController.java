package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.system.demo.course.dto.PublishValidationResult;
import com.example.starter_project_2025.system.demo.course.dto.ReorderRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/courses")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Course", description = "APIs for managing courses")
public class CourseController
        extends BaseCrudDataIoController<Course, Long, CourseDTO, CourseFilter> {

    CourseService courseService;
    CourseRepository courseRepository;

    @Override
    protected BaseCrudService<Long, CourseDTO, CourseFilter> getService() {
        return courseService;
    }

    @Override
    protected BaseCrudRepository<Course, Long> getRepository() {
        return courseRepository;
    }

    @Override
    protected Class<Course> getEntityClass() {
        return Course.class;
    }

    @Override
    @GetMapping
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public ResponseEntity<Page<CourseDTO>> getAll(
            @PageableDefault Pageable pageable,
            @RequestParam(required = false) String search,
            @ModelAttribute CourseFilter filter
    ) {
        return super.getAll(pageable, search, filter);
    }

    @Override
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public ResponseEntity<CourseDTO> getById(@PathVariable Long id) {
        return super.getById(id);
    }

    @Override
    @PostMapping
    @PreAuthorize("hasAuthority('COURSE_CREATE')")
    public ResponseEntity<CourseDTO> create(
            @Validated(OnCreate.class) @RequestBody CourseDTO request
    ) {
        return super.create(request);
    }

    @Override
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('COURSE_UPDATE')")
    public ResponseEntity<CourseDTO> update(
            @PathVariable Long id,
            @Validated(OnUpdate.class) @RequestBody CourseDTO request
    ) {
        return super.update(id, request);
    }

    @Override
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('COURSE_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return super.delete(id);
    }

    @Override
    @GetMapping("/export")
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public void exportFile(
            @RequestParam(defaultValue = "EXCEL") FileFormat format,
            HttpServletResponse response
    ) throws IOException {
        super.exportFile(format, response);
    }

    @Override
    @PostMapping(value = "/import", consumes = "multipart/form-data")
    @PreAuthorize("hasAuthority('COURSE_CREATE')")
    public ImportResult importFile(@RequestParam("file") MultipartFile file) {
        return super.importFile(file);
    }

    // ------------------------------------------------------------------ M2: validate & publish

    /**
     * Kiểm tra khoá học có đủ điều kiện publish không (không thay đổi trạng thái).
     * Response: {@code {"valid": true/false, "errors": [...]}}
     */
    @GetMapping("/{id}/validate-publish")
    @PreAuthorize("hasAuthority('COURSE_UPDATE')")
    @Operation(summary = "Validate khoá học trước khi publish",
               description = "Kiểm tra ≥1 section, mỗi section ≥1 lesson, URL video/tài liệu hợp lệ. Không thay đổi trạng thái.")
    public ResponseEntity<PublishValidationResult> validatePublish(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.validateForPublish(id));
    }

    /**
     * Publish khoá học: validate trước, nếu pass → chuyển status → PUBLISHED.
     * Trả về CourseDTO đã cập nhật, hoặc 400 nếu validate fail.
     */
    @PostMapping("/{id}/publish")
    @PreAuthorize("hasAuthority('COURSE_UPDATE')")
    @Operation(summary = "Publish khoá học",
               description = "Validate rồi chuyển trạng thái khoá học sang PUBLISHED. Trả 400 nếu chưa đủ điều kiện.")
    public ResponseEntity<CourseDTO> publishCourse(@PathVariable Long id) {
        return ResponseEntity.ok(courseService.publishCourse(id));
    }

    // ------------------------------------------------------------------ M2: batch reorder

    /**
     * Cập nhật thứ tự Section và Lesson trong 1 request (batch).
     * Hỗ trợ di chuyển Lesson sang Section khác cùng khoá học.
     *
     * <pre>
     * PATCH /api/courses/{id}/reorder
     * {
     *   "sections": [
     *     { "sectionId": 1, "orderIndex": 0,
     *       "lessons": [
     *         { "lessonId": 10, "orderIndex": 0 },
     *         { "lessonId": 11, "orderIndex": 1 }
     *       ]
     *     },
     *     { "sectionId": 2, "orderIndex": 1, "lessons": [] }
     *   ]
     * }
     * </pre>
     */
    @PatchMapping("/{id}/reorder")
    @PreAuthorize("hasAuthority('COURSE_UPDATE')")
    @Operation(summary = "Batch reorder section & lesson",
               description = "Đổi thứ tự Section/Lesson hàng loạt. Lesson có thể được chuyển sang Section khác trong cùng khoá học.")
    public ResponseEntity<Void> reorderCurriculum(
            @PathVariable Long id,
            @Valid @RequestBody ReorderRequest request
    ) {
        courseService.reorderCurriculum(id, request);
        return ResponseEntity.noContent().build();
    }
}

