package com.example.starter_project_2025.system.schedule;

import jakarta.persistence.*;
import lombok.*;

/** All schedule writers lock row 1 until their enclosing transaction commits. */
@Entity
@Table(name = "schedule_validation_lock")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor
public class ScheduleWriteLock {
    @Id private Long id;
}
