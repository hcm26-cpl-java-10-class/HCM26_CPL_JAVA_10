package com.example.starter_project_2025.system.rbac.location;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LocationTreeDTO {
    Long id;
    String code;
    String name;
    Long parentId;
    String status;

    Integer totalUsers;

    @Builder.Default
    List<UserSummaryDTO> users = new ArrayList<>();

    @Builder.Default
    List<LocationTreeDTO> children = new ArrayList<>();
}