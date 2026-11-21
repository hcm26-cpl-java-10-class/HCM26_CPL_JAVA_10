package com.example.starter_project_2025.system.management.student;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class StudentDTO extends BaseDTO {

    @NotBlank(groups = OnCreate.class, message = "Student code is required")
    @Size(max = 30)
    String studentCode;

    @NotBlank(groups = OnCreate.class, message = "First name is required")
    @Size(max = 100)
    String firstName;

    @Size(max = 100)
    String lastName;

    @NotBlank(groups = OnCreate.class, message = "Student email is required")
    @Email(message = "Student email is invalid")
    @Size(max = 100)
    String email;

    @Size(max = 20)
    String phone;

    LocalDate dateOfBirth;

    String gender;

    // Các lớp đào tạo được chọn khi tạo/cập nhật sinh viên.
    List<Long> trainingClassIds;

    // Danh sách mã lớp dùng để hiển thị ở bảng Students.
    String trainingClass;

    @Size(max = 1000)
    String address;

    String status;
}