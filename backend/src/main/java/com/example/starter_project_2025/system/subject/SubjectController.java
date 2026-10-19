package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.Operation;
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

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/subjects")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Subject", description = "APIs for managing subjects and topics")
public class SubjectController
        extends BaseCrudController<Long, SubjectDTO, SubjectFilter> {

    SubjectService subjectService;
@Tag(name = "Subject Management", description = "APIs for managing subjects and topics")
public class SubjectController
        extends BaseCrudDataIoController<Subject, Long, SubjectDTO, SubjectFilter> {

    SubjectService subjectService;
    SubjectRepository subjectRepository;

    @Override
    protected BaseCrudService<Long, SubjectDTO, SubjectFilter> getService() {
        return subjectService;
    }

    @Override
    @GetMapping
    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    @Operation(summary = "Get list of subjects with pagination and filter")
    public ResponseEntity<Page<SubjectDTO>> getAll(
            @PageableDefault Pageable pageable,
            @RequestParam(required = false) String search,
            @ModelAttribute SubjectFilter filter
    ) {
        return super.getAll(pageable, search, filter);
    }

    @Override
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('SUBJECT_READ')")
    @Operation(summary = "Get subject details by ID")
    public ResponseEntity<SubjectDTO> getById(@PathVariable Long id) {
        return super.getById(id);
    }

    @Override
    @PostMapping
    @PreAuthorize("hasAuthority('SUBJECT_CREATE')")
    @Operation(summary = "Create new subject")
    public ResponseEntity<SubjectDTO> create(
            @Validated(OnCreate.class) @RequestBody SubjectDTO request
    ) {
        return super.create(request);
    }

    @Override
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('SUBJECT_UPDATE')")
    @Operation(summary = "Update subject by ID")
    public ResponseEntity<SubjectDTO> update(
            @PathVariable Long id,
            @Validated(OnUpdate.class) @RequestBody SubjectDTO request
    ) {
        return super.update(id, request);
    }

    @Override
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('SUBJECT_DELETE')")
    @Operation(summary = "Delete subject")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return super.delete(id);
    protected BaseCrudRepository<Subject, Long> getRepository() {
        return subjectRepository;
    }

    @Override
    protected Class<Subject> getEntityClass() {
        return Subject.class;
    }

    @GetMapping("/active")
    @Operation(summary = "Lấy danh sách môn học đang hoạt động", description = "Lấy danh mục môn học đang hoạt động")
    public ResponseEntity<List<SubjectDTO>> getActiveSubjects() {
        return ResponseEntity.ok(subjectService.getActiveSubjects());
    }

    @PatchMapping("/{id}/status")
    @Operation(summary = "Đổi trạng thái môn học (kích hoạt / ngừng sử dụng)")
    public ResponseEntity<SubjectDTO> changeStatus(
            @PathVariable Long id,
            @RequestParam Boolean active
    ) {
        return ResponseEntity.ok(subjectService.changeStatus(id, active));
    }

    @GetMapping("/{id}/is-referenced")
    @Operation(summary = "Kiểm tra môn học đã được tham chiếu hay chưa", description = "Kiểm tra xem môn học đã được sử dụng trong lịch học hoặc chương trình đào tạo hay chưa")
    public ResponseEntity<Boolean> isSubjectReferenced(@PathVariable Long id) {
        return ResponseEntity.ok(subjectService.isSubjectReferenced(id));
    }
}
