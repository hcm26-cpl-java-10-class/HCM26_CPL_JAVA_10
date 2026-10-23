package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.security.access.prepost.PreAuthorize;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/users")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "User", description = "APIs for managing users")
public class UserController
        extends BaseCrudDataIoController<User, Long, UserDTO, UserFilter> {

    UserService service;
    UserRepository repository;

    @Override
    protected BaseCrudService<Long, UserDTO, UserFilter> getService() {
        return service;
    }

    @Override
    protected BaseCrudRepository<User, Long> getRepository() {
        return repository;
    }

    @Override
    protected Class<User> getEntityClass() {
        return User.class;
    }

    @PatchMapping("/{id}/lock")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> lockUser(@PathVariable Long id) {
        service.lockUser(id);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{id}/unlock")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> unlockUser(@PathVariable Long id) {
        service.unlockUser(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Danh sách sinh viên đang hoạt động - dùng để chọn nhiều sinh viên khi
     * tạo lời mời hàng loạt.
     */
    @GetMapping("/students")
    @PreAuthorize("hasAuthority('INVITATION_READ') or hasAuthority('USER_READ')")
    public ResponseEntity<List<StudentSummaryDTO>> students() {
        return ResponseEntity.ok(service.findStudents());
    }

}
