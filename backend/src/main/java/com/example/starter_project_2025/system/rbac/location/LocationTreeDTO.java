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

    String path;   // Đường dẫn cây: "VN / HN / Cơ sở 1"
    Integer level; // Độ sâu (0, 1, 2...)

    LocationStatus status; // Chuẩn Enum Type-Safety

    Integer totalUsers;

    @Builder.Default
    List<UserSummaryDTO> users = new ArrayList<>();

    @Builder.Default
    List<LocationTreeDTO> children = new ArrayList<>();
}