package com.example.starter_project_2025.system.schedule.generation;

import jakarta.persistence.*;
import lombok.*;

/** Durable, transactionally committed replay result, scoped to actor, endpoint and class. */
@Entity
@Table(name="bulk_schedule_receipts")
@Getter @Setter @NoArgsConstructor
public class BulkScheduleReceipt {
    @Id @Column(length=64) private String id;
    @Column(nullable=false,length=64) private String requestHash;
    @Lob @Column(nullable=false) private String responseJson;
}
