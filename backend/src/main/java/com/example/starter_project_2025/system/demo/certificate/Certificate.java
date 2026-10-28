package com.example.starter_project_2025.system.demo.certificate;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;
import java.util.UUID;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "certificates",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_certificate_user_course",
                        columnNames = {"user_id", "course_id"}
                )
        }
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("certificate")
@ExportEntity(fileName = "certificates", sheetName = "Certificates")
@ResourcePermission("CERTIFICATE")
@ResourceMenu(
        title = "Certificates",
        group = "Course Management",
        icon = "graduation-cap",
        url = "/certificates",
        order = 2,
        permission = "CERTIFICATE_READ"
)
public class Certificate extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @ImportField(name = "Student", required = true, lookupEntity = User.class)
    @ExportField(name = "Student")
    User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    @ImportField(name = "Course", required = true, lookupEntity = Course.class, lookupField = "name")
    @ExportField(name = "Course")
    Course course;

    @Column(nullable = false, unique = true, updatable = false)
    private UUID verificationToken;

    @Column(nullable = false, updatable = false)
    private LocalDate issuedAt;

    @PrePersist
    private void prepareCertificate() {
        if (verificationToken == null) {
            verificationToken = UUID.randomUUID();
        }

        if (issuedAt == null) {
            issuedAt = LocalDate.now();
        }
    }

}
