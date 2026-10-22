package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import com.example.starter_project_2025.system.demo.department.Department;
import com.example.starter_project_2025.system.rbac.role.Role;
import org.mapstruct.*;

import java.util.Set;
import java.util.stream.Collectors;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface UserMapper extends BaseCrudMapper<User, UserDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "passwordHash", ignore = true)
    User toEntity(UserDTO request);

    @Override
    @Mapping(target = "roleIds", expression = "java(mapRoleIds(user))")
    @Mapping(target = "departmentId", expression = "java(mapPrimaryDepartmentId(user))")
    @Mapping(target = "departmentName", expression = "java(mapPrimaryDepartmentName(user))")
    @Mapping(target = "departmentIds", expression = "java(mapDepartmentIds(user))")
    @Mapping(target = "departmentNames", expression = "java(mapDepartmentNames(user))")
    @Mapping(target = "password", ignore = true)
    @Mapping(target = "clearDepartment", ignore = true)
    UserDTO toResponse(User user);

    @Override
    @Mapping(target = "passwordHash", ignore = true)
    @Mapping(target = "departments", ignore = true)
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void update(@MappingTarget User user, UserDTO dto);

    default Set<Long> mapRoleIds(User user) {
        if (user.getRoles() == null) {
            return null;
        }

        return user.getRoles()
                .stream()
                .map(Role::getId)
                .collect(Collectors.toSet());
    }

    default Set<Long> mapDepartmentIds(User user) {
        return user.getDepartments()
                .stream()
                .map(Department::getId)
                .collect(Collectors.toSet());
    }

    default Set<String> mapDepartmentNames(User user) {
        return user.getDepartments()
                .stream()
                .map(Department::getName)
                .collect(Collectors.toSet());
    }

    default Long mapPrimaryDepartmentId(User user) {
        return user.getDepartments()
                .stream()
                .map(Department::getId)
                .min(Long::compareTo)
                .orElse(null);
    }

    default String mapPrimaryDepartmentName(User user) {
        return user.getDepartments()
                .stream()
                .min((left, right) -> left.getId().compareTo(right.getId()))
                .map(Department::getName)
                .orElse(null);
    }
}
