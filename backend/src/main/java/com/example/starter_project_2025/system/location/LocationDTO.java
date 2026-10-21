package com.example.starter_project_2025.system.location;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LocationDTO extends BaseDTO {
    private String code;
    private String name;
    private Long parentId;
    private String status;
    private List<LocationDTO> children = new ArrayList<>();
    private Boolean isActive;
}