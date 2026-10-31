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
}
