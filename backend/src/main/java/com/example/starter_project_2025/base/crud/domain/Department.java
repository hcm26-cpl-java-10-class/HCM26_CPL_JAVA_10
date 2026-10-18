package com.example.starter_project_2025.base.crud.domain;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "departments")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@SuperBuilder
public class Department extends BaseEntity {

    @Column(name = "code", nullable = false, unique = true, length = 50)
    private String code;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    // Tự tham chiếu phòng ban cha (Self-referencing parent)
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_department_id")
    private Department parent;

    @OneToMany(mappedBy = "parent", cascade = CascadeType.ALL)
    @Builder.Default
    private List<Department> children = new ArrayList<>();

    // Thuộc tính location_id để nullable (không chờ Task T18 của TV7)
    @Column(name = "location_id")
    private UUID locationId;

    @Column(name = "status", nullable = false)
    private String status;
}