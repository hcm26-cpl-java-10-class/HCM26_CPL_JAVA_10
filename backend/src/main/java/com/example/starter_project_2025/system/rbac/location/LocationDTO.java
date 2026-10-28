package com.example.starter_project_2025.system.location;

import lombok.*;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationDTO {
    private Long id;
    private String code;
    private String name;
    private Long parentId;
    private String status;

    @Builder.Default
    private List<LocationDTO> children = new ArrayList<>();
}
