package com.example.starter_project_2025.system.auth.authentication;

import com.example.starter_project_2025.system.auth.authentication.dto.request.RegisterRequest;
import com.example.starter_project_2025.system.rbac.user.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface AuthMapper {

    @Mapping(target = "id", ignore = true)
    User toEntity(RegisterRequest request);
}
