package com.example.starter_project_2025.system.project.charter;

import jakarta.persistence.*;
import lombok.*;

/** Charter responsibilities supplement, but never replace, Allocation's roles. */
@Entity
@Table(name = "team_charter_responsibilities", uniqueConstraints = @UniqueConstraint(
        name = "uk_charter_responsibility", columnNames = {"team_id", "membership_id"}))
@Getter @Setter @NoArgsConstructor
public class TeamCharterResponsibility {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "team_id", nullable = false) private Long teamId;
    // Deliberately not a cascading membership FK: removing a member must preserve prior evidence.
    @Column(name = "membership_id", nullable = false) private Long membershipId;
    @Column(nullable = false, length = 1000) private String responsibility;
}
