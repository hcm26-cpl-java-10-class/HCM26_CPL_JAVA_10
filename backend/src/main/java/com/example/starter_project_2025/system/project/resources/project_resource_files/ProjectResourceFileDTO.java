package com.example.starter_project_2025.system.project.resources.project_resource_files;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ProjectResourceFileDTO extends BaseDTO {

    /** Owning project resource; immutable once the file exists. */
    Long resourceId;

    String storageKey;

    String originalName;

    String contentType;

    Long sizeBytes;
}
