package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(name = "anonymous_session")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class AnonymousSession extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "invitation_id", nullable = false)
    private Invitation invitation;

    @Column(nullable = false, unique = true, length = 64)
    private String sessionToken;

    @Column(length = 256)
    private String fingerprint;

    @Column(nullable = false)
    private LocalDateTime accessedAt;

    private LocalDateTime completedAt;

    @Column(length = 50)
    private String ipAddress;

    @Column(length = 200)
    private String userAgent;

    @Builder.Default
    @Column(nullable = false)
    private Boolean isValid = true;
}
