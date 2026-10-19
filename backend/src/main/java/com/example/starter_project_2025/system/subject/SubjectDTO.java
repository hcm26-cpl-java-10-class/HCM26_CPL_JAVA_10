package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SubjectDTO extends BaseDTO {

    @NotBlank(groups = OnCreate.class, message = "Mã môn học không được để trống")
    @Size(max = 50, message = "Mã môn học tối đa 50 ký tự")
    String code;

    @NotBlank(groups = OnCreate.class, message = "Tên môn học không được để trống")
    @Size(max = 150, message = "Tên môn học tối đa 150 ký tự")
    String name;

    @NotBlank(groups = OnCreate.class, message = "Phiên bản không được để trống")
    @Size(max = 20, message = "Phiên bản tối đa 20 ký tự")
    @Builder.Default
    String version = "1.0";

    @Size(max = 500, message = "Mô tả tối đa 500 ký tự")
    String description;

    @Size(max = 100, message = "Nhóm chuyên môn tối đa 100 ký tự")
    String technicalGroup;

    @NotNull(groups = OnCreate.class, message = "Thời lượng môn học không được để trống")
    @Min(value = 1, message = "Thời lượng môn học phải lớn hơn hoặc bằng 1 giờ")
    Integer durationHours;

    @Builder.Default
    SubjectStatus status = SubjectStatus.ACTIVE;
    @NotBlank(groups = OnCreate.class, message = "Subject code is required")
    @Size(max = 50, message = "Subject code must not exceed 50 characters")
    String code;

    @NotBlank(groups = OnCreate.class, message = "Subject name is required")
    @Size(max = 255, message = "Subject name must not exceed 255 characters")
    String name;

    @NotBlank(groups = OnCreate.class, message = "Version is required")
    @Size(max = 20, message = "Version must not exceed 20 characters")
    String version;

    @Size(max = 1000, message = "Description must not exceed 1000 characters")
    String description;

    @Size(max = 100, message = "Technical group must not exceed 100 characters")
    String technicalGroup;

    @NotNull(groups = OnCreate.class, message = "Duration is required")
    @Min(value = 1, message = "Duration must be greater than 0")
    Integer durationHours;
}
