package com.example.starter_project_2025.system.schedule.notification;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
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
public class NotificationDTO extends BaseDTO {

    @NotNull(groups = OnCreate.class, message = "User ID is required")
    Long userId;

    @NotBlank(groups = OnCreate.class, message = "Title is required")
    @Size(max = 150, message = "Title must not exceed 150 characters")
    String title;

    @NotBlank(groups = OnCreate.class, message = "Message is required")
    @Size(max = 500, message = "Message must not exceed 500 characters")
    String message;

    Boolean isRead;
}