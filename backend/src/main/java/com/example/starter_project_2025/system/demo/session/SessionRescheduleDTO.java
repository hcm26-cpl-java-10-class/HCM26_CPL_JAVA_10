package com.example.starter_project_2025.system.demo.session;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * Moves a scheduled session to a new time slot (and optionally another room).
 * Class, topic, trainer and title are deliberately not part of this contract.
 */
@Getter
@Setter
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SessionRescheduleDTO {

    @NotNull(message = "Start time is required")
    LocalDateTime startTime;

    @NotNull(message = "End time is required")
    LocalDateTime endTime;

    /** When null the current room is kept. */
    @Size(max = 150, message = "Location must not exceed 150 characters")
    String location;
}
