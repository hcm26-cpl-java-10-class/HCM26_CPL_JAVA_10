package com.example.starter_project_2025.system.schedule.session.dto;

import lombok.*;
import lombok.experimental.FieldDefaults;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SessionCancelRequest {

    String cancelReason;

    String notes;

    Long version;
}
