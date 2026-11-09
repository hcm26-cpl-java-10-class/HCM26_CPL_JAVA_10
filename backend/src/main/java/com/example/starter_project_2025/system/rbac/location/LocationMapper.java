package com.example.starter_project_2025.system.rbac.location;

import com.example.starter_project_2025.base.crud.mapper.BaseCrudMapper;
import com.example.starter_project_2025.base.crud.mapper.BaseMapperConfig;
import com.example.starter_project_2025.base.crud.mapper.IgnoreAuditFields;
import org.mapstruct.*;

import java.util.List;

@Mapper(componentModel = "spring", config = BaseMapperConfig.class)
public interface LocationMapper extends BaseCrudMapper<Location, LocationDTO> {

    @Override
    @IgnoreAuditFields
    @Mapping(target = "users", ignore = true)
    @Mapping(target = "parentId", source = "parentLocationId")
    Location toEntity(LocationDTO request);

    @Override
    @Mapping(target = "parentLocationId", source = "parentId")
    @Mapping(target = "parentLocationName", ignore = true)
    @Mapping(target = "users", ignore = true)
    @Mapping(target = "totalUsers", ignore = true)
    LocationDTO toResponse(Location location);

    @Override
    @IgnoreAuditFields
    @Mapping(target = "users", ignore = true)
    @Mapping(target = "parentId", source = "parentLocationId")
    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void update(@MappingTarget Location location, LocationDTO request);

    @AfterMapping
    default void mapUsers(Location location, @MappingTarget LocationDTO dto) {
        if (location.getUsers() != null && !location.getUsers().isEmpty()) {
            List<UserSummaryDTO> userSummaries = location.getUsers().stream()
                    .map(u -> UserSummaryDTO.builder()
                            .id(u.getId())
                            .email(u.getEmail())
                            .fullName(u.getFullName())
                            .phone(u.getPhone())
                            .build())
                    .toList();
            dto.setUsers(userSummaries);
            dto.setTotalUsers(userSummaries.size());
        } else {
            dto.setUsers(List.of());
            dto.setTotalUsers(0);
        }
    }
}