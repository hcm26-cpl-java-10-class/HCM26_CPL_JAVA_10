package com.example.starter_project_2025.system.schedule.trainingclass.dto;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
@NoArgsConstructor
public class CreateTrainingClassRequest {

    @NotBlank(message = "Mã lớp không được để trống")
    @Size(max = 255, message = "Mã lớp tối đa 255 ký tự")
    private String code;

    @NotBlank(message = "Tên lớp không được để trống")
    @Size(max = 255, message = "Tên lớp tối đa 255 ký tự")
    private String name;

    @NotBlank(message = "Loại học viên không được để trống")
    @Size(max = 255, message = "Loại học viên tối đa 255 ký tự")
    private String traineeType;

    @NotBlank(message = "Hình thức đào tạo không được để trống")
    @Size(max = 255, message = "Hình thức đào tạo tối đa 255 ký tự")
    private String deliveryFormat;

    @NotBlank(message = "Cơ sở không được để trống")
    @Size(max = 255, message = "Cơ sở tối đa 255 ký tự")
    private String site;

    @NotBlank(message = "Địa điểm không được để trống")
    @Size(max = 255, message = "Địa điểm tối đa 255 ký tự")
    private String location;

    @NotNull(message = "Phải chọn phiên bản chương trình")
    @Positive(message = "ID phiên bản chương trình phải lớn hơn 0")
    private Long programVersionId;

    @NotNull(message = "Phải nhập ngày bắt đầu")
    private LocalDate startDate;

    @NotNull(message = "Phải nhập ngày kết thúc")
    private LocalDate endDate;

    @NotNull(message = "Phải nhập sức chứa")
    @Positive(message = "Sức chứa phải lớn hơn 0")
    private Integer capacity;
}