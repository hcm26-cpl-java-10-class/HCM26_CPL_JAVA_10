
package com.example.starter_project_2025.system.demo.department;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.base.dataio.common.FileFormat;
import com.example.starter_project_2025.base.dataio.importer.result.ImportResult;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentDTO;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
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
import org.springframework.web.multipart.MultipartFile;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/departments")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Department", description = "APIs for managing departments")
public class DepartmentController
        extends BaseCrudDataIoController<
        Department, Long, DepartmentDTO, DepartmentFilter> {

    DepartmentService departmentService;
    DepartmentRepository departmentRepository;
    UserRepository userRepository;
    CourseEnrollmentRepository enrollmentRepository;

    @Override
    protected BaseCrudService<Long, DepartmentDTO, DepartmentFilter>
    getService() {
        return departmentService;
    }

    @Override
    protected BaseCrudRepository<Department, Long> getRepository() {
        return departmentRepository;
    }

    @Override
    protected Class<Department> getEntityClass() {
        return Department.class;
    }

    @GetMapping("/{id}/stats")
    @PreAuthorize("hasAuthority('DEPARTMENT_READ')")
    public ResponseEntity<DepartmentStatsDTO> getStats(@PathVariable Long id) {
        requireDepartment(id);
        return ResponseEntity.ok(new DepartmentStatsDTO(
                userRepository.countActiveStudentsByDepartmentId(id),
                enrollmentRepository.countDistinctCoursesByDepartmentId(id)
        ));
    }

    @GetMapping("/{id}/members")
    @PreAuthorize("hasAuthority('DEPARTMENT_READ')")
    public ResponseEntity<Page<DepartmentMemberDTO>> getMembers(
            @PathVariable Long id,
            @PageableDefault(size = 20, sort = "firstName") Pageable pageable,
            @RequestParam(required = false) String search) {
        requireDepartment(id);
        return ResponseEntity.ok(userRepository.searchActiveStudentsByDepartmentId(
                id, normalizeSearch(search), pageable));
    }

    @GetMapping("/{id}/members/{userId}/courses")
    @PreAuthorize("hasAuthority('DEPARTMENT_READ')")
    public ResponseEntity<List<CourseEnrollmentDTO>> getMemberCourses(
            @PathVariable Long id,
            @PathVariable Long userId) {
        Department department = requireDepartment(id);
        User student = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));
        if (!Boolean.TRUE.equals(student.getIsActive())
                || student.getRoles().stream().noneMatch(role -> "STUDENT".equalsIgnoreCase(role.getName()))
                || student.getDepartments().stream()
                .noneMatch(memberDepartment -> department.getId().equals(memberDepartment.getId()))) {
            throw new BadRequestException("Student is not an active member of this department");
        }

        List<CourseEnrollmentDTO> courses = enrollmentRepository
                .findAllByUser_IdOrderByCreatedAtDesc(student.getId())
                .stream()
                .map(this::toEnrollmentDTO)
                .toList();
        return ResponseEntity.ok(courses);
    }

    @GetMapping("/{id}/available-students")
    @PreAuthorize("hasAuthority('DEPARTMENT_READ')")
    public ResponseEntity<Page<DepartmentMemberDTO>> getAvailableStudents(
            @PathVariable Long id,
            @PageableDefault(size = 20, sort = "firstName") Pageable pageable,
            @RequestParam(required = false) String search) {
        requireDepartment(id);
        return ResponseEntity.ok(userRepository.searchActiveStudentsOutsideDepartment(
                id, normalizeSearch(search), pageable));
    }

    @PutMapping("/{id}/members/{userId}")
    @PreAuthorize("hasAuthority('DEPARTMENT_UPDATE')")
    @Transactional
    public ResponseEntity<Void> assignMember(
            @PathVariable Long id,
            @PathVariable Long userId) {
        Department department = requireDepartment(id);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));
        if (!Boolean.TRUE.equals(user.getIsActive())
                || user.getRoles().stream().noneMatch(role -> "STUDENT".equalsIgnoreCase(role.getName()))) {
            throw new BadRequestException("Only active students can be assigned to a department");
        }

        user.getDepartments().add(department);
        userRepository.save(user);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/members/{userId}")
    @PreAuthorize("hasAuthority('DEPARTMENT_UPDATE')")
    @Transactional
    public ResponseEntity<Void> removeMember(
            @PathVariable Long id,
            @PathVariable Long userId) {
        requireDepartment(id);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));
        Department department = requireDepartment(id);
        if (!user.getDepartments().remove(department)) {
            throw new BadRequestException("Student is not a member of this department");
        }

        userRepository.save(user);
        return ResponseEntity.noContent().build();
    }

    private Department requireDepartment(Long id) {
        return departmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Department not found"));
    }

    private String normalizeSearch(String search) {
        return search == null || search.isBlank() ? null : search.trim();
    }

    private CourseEnrollmentDTO toEnrollmentDTO(CourseEnrollment enrollment) {
        return CourseEnrollmentDTO.builder()
                .id(enrollment.getId())
                .courseId(enrollment.getCourse().getId())
                .courseName(enrollment.getCourse().getName())
                .thumbnailUrl(enrollment.getCourse().getThumbnailUrl())
                .instructor(enrollment.getCourse().getInstructor())
                .enrolledAt(enrollment.getCreatedAt())
                .build();
    }

    @Override
    @GetMapping
    @PreAuthorize("hasAuthority('DEPARTMENT_READ')")
    public ResponseEntity<Page<DepartmentDTO>> getAll(
            @PageableDefault Pageable pageable,
            @RequestParam(required = false) String search,
            @ModelAttribute DepartmentFilter filter) {
        return super.getAll(pageable, search, filter);
    }

    @Override
    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('DEPARTMENT_READ')")
    public ResponseEntity<DepartmentDTO> getById(
            @PathVariable Long id) {
        return super.getById(id);
    }

    @Override
    @PostMapping
    @PreAuthorize("hasAuthority('DEPARTMENT_CREATE')")
    public ResponseEntity<DepartmentDTO> create(
            @Validated(OnCreate.class)
            @RequestBody DepartmentDTO request) {
        return super.create(request);
    }

    @Override
    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('DEPARTMENT_UPDATE')")
    public ResponseEntity<DepartmentDTO> update(
            @PathVariable Long id,
            @Validated(OnUpdate.class)
            @RequestBody DepartmentDTO request) {
        return super.update(id, request);
    }

    @Override
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('DEPARTMENT_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return super.delete(id);
    }

    @Override
    @GetMapping("/export")
    @PreAuthorize("hasAuthority('DEPARTMENT_READ')")
    public void exportFile(
            @RequestParam(defaultValue = "EXCEL") FileFormat format,
            HttpServletResponse response) throws IOException {
        super.exportFile(format, response);
    }

    @Override
    @PostMapping(value = "/import", consumes = "multipart/form-data")
    @PreAuthorize("hasAuthority('DEPARTMENT_CREATE')")
    public ImportResult importFile(
            @RequestParam("file") MultipartFile file) {
        return super.importFile(file);
    }
}
