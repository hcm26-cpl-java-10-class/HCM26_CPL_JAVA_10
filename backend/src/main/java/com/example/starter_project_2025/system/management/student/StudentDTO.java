package com.example.starter_project_2025.system.management.student;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDate;

import static com.fasterxml.jackson.annotation.JsonProperty.Access.READ_ONLY;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class StudentDTO extends BaseDTO {
    @NotBlank(groups = OnCreate.class, message = "Student code is required")
    @Size(max = 30, message = "Student code must not exceed 30 characters")
    String studentCode;

    @NotBlank(groups = OnCreate.class, message = "First name is required")
    @Size(max = 100)
    String firstName;

    @NotBlank(groups = OnCreate.class, message = "Last name is required")
    @Size(max = 100)
    String lastName;

    @NotBlank(groups = OnCreate.class, message = "Student email is required")
    
    @Size(max = 30)
    String phone;

    LocalDate dateOfBirth;

    @Size(max = 20)
    String gender;

    @NotBlank(groups = OnCreate.class, message = "Class name is required")
   

    @Size(max = 500)
    String address;

    String status;
}
