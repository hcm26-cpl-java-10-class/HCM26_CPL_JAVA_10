package com.example.starter_project_2025.system.demo.session;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * Creates a new SCHEDULED session from an existing one. Class, topic, trainer, title and note are
 * copied from the source session; only the time slot (and optionally the room) is supplied.
 */
@Getter
@Setter
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SessionDuplicateDTO {

    @NotNull(message = "Start time is required")
    LocalDateTime startTime;

    @NotNull(message = "End time is required")
    LocalDateTime endTime;

    /** When null the room of the source session is copied. */
    @Size(max = 150, message = "Location must not exceed 150 characters")
    String location;
}
