package com.example.starter_project_2025.system.demo.session;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SessionCancelDTO {

    @NotBlank(message = "Cancel reason is required")
    @Size(max = 255, message = "Cancel reason must not exceed 255 characters")
    String cancelReason;
}
