package com.example.starter_project_2025.system.trainer;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.subject.Subject;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.proxy.HibernateProxy;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/** Internal identity namespace. Never equate this ID to a shared-system trainer ID. */
@Entity
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
@Table(name = "trainers", uniqueConstraints = {
    @UniqueConstraint(name = "uk_trainer_code", columnNames = "trainer_code"),
    @UniqueConstraint(name = "uk_trainer_email", columnNames = "email")
})
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("trainer")
@ExportEntity(fileName = "trainers", sheetName = "Trainers")
@ResourcePermission("TRAINER")
@ResourceMenu(
    title = "Trainers",
    group = "Training Management",
    icon = "users",
    url = "/trainers",
    order = 7,
    permission = "TRAINER_READ"
)
public class Trainer extends BaseEntity {

    public static final int MAX_CODE_LENGTH = 20;
    public static final int MAX_FULL_NAME_LENGTH = 80;
    public static final int MAX_EMAIL_LENGTH = 100;
    public static final int MAX_SPECIALIZATION_LENGTH = 200;

    public static final String CODE_REGEX = "[A-Za-z0-9][A-Za-z0-9_-]{0,19}";
    public static final String EMAIL_REGEX = "^[^\\s@]+@[^\\s@.]+(\\.[^\\s@.]+)+$";

    @Column(name = "trainer_code", nullable = false, length = MAX_CODE_LENGTH)
    @ImportField(name = "Trainer ID*", required = true)
    @ExportField(name = "Trainer ID")
    String trainerCode;

    @Column(nullable = false, length = MAX_FULL_NAME_LENGTH)
    @ImportField(name = "Full Name*", required = true)
    @ExportField(name = "Full Name")
    String fullName;

    @Column(nullable = false, length = MAX_EMAIL_LENGTH)
    @ImportField(name = "Work Email*", required = true)
    @ExportField(name = "Work Email")
    String email;

    @Column(length = MAX_SPECIALIZATION_LENGTH)
    @ImportField(name = "Specialization")
    @ExportField(name = "Specialization")
    String specialization;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @ImportField(name = "Status")
    @ExportField(name = "Status")
    TrainerStatus status = TrainerStatus.ACTIVE;

    @Builder.Default
    @Getter(AccessLevel.NONE)
    @ManyToMany(fetch = FetchType.LAZY)
    @ExportField(name = "Teaching Topics", relation = true, path = "code")
    @ImportField(name = "Teaching Topics", lookupEntity = Subject.class, lookupField = "code", separator = ";")
    @JoinTable(
        name = "trainer_teaching_topics",
        joinColumns = @JoinColumn(name = "trainer_id"),
        inverseJoinColumns = @JoinColumn(name = "subject_id")
    )
    Set<Subject> teachingTopics = new LinkedHashSet<>();

    public static Trainer create(
            String trainerCode, String fullName, String email,
            String specialization, TrainerStatus status, Collection<Subject> teachingTopics
    ) {
        var profile = TrainerValidation.validateProfile(trainerCode, fullName, email, specialization, status, teachingTopics);
        Trainer trainer = new Trainer();
        trainer.isActive = Boolean.TRUE;
        trainer.commitProfile(profile);
        return trainer;
    }

    public void updateProfile(
            String trainerCode, String fullName, String email,
            String specialization, TrainerStatus status, Collection<Subject> teachingTopics
    ) {
        requireNotArchived("update");
        commitProfile(TrainerValidation.validateProfile(trainerCode, fullName, email, specialization, status, teachingTopics));
    }

    public void changeStatus(TrainerStatus newStatus) {
        requireNotArchived("change status of");
        this.status = TrainerValidation.requireStatus(newStatus);
    }

    public void activate() { changeStatus(TrainerStatus.ACTIVE); }

    public void deactivate() { changeStatus(TrainerStatus.INACTIVE); }

    public void archive() {
        this.isActive = Boolean.FALSE;
        this.status = TrainerStatus.INACTIVE;
    }

    public boolean isArchived() { return !Boolean.TRUE.equals(this.isActive); }

    public boolean isActiveTrainer() { return Boolean.TRUE.equals(this.isActive) && this.status == TrainerStatus.ACTIVE; }

    public Set<Subject> getTeachingTopics() { return Collections.unmodifiableSet(this.teachingTopics); }

    public boolean canTeachTopic(Long subjectId) {
        return subjectId != null && this.teachingTopics.stream().anyMatch(s -> subjectId.equals(s.getId()));
    }

    @Override
    public void setId(Long id) {
        if (this.id != null && !Objects.equals(this.id, id)) {
            throw new UnsupportedOperationException("Trainer ID cannot be changed once assigned.");
        }
        this.id = id;
    }

    @Override
    public void setIsActive(Boolean isActive) {
        if (isActive == null) throw new BadRequestException("Active flag is required.");
        if (isArchived() && Boolean.TRUE.equals(isActive)) throw new ConflictException("Archived trainer cannot be reactivated.");
        if (Boolean.FALSE.equals(isActive)) { archive(); return; }
        this.isActive = Boolean.TRUE;
    }

    @PrePersist
    @PreUpdate
    void ensureValidState() {
        if (this.isActive == null) this.isActive = Boolean.TRUE;
        if (this.status == null) this.status = TrainerStatus.ACTIVE;
        if (isArchived()) this.status = TrainerStatus.INACTIVE;
    }

    private void commitProfile(TrainerValidation.ValidatedProfile profile) {
        this.trainerCode = profile.trainerCode();
        this.fullName = profile.fullName();
        this.email = profile.email();
        this.specialization = profile.specialization();
        this.status = profile.status();
        this.teachingTopics.clear();
        this.teachingTopics.addAll(profile.teachingTopics());
    }

    private void requireNotArchived(String action) {
        if (isArchived()) throw new ConflictException("Cannot " + action + " an archived trainer.");
    }

    @Override
    public final boolean equals(Object other) {
        if (this == other) return true;
        if (other == null || effectiveClass(this) != effectiveClass(other)) return false;
        Long thisId = this.getId();
        return thisId != null && Objects.equals(thisId, ((Trainer) other).getId());
    }

    @Override
    public final int hashCode() { return effectiveClass(this).hashCode(); }

    private static Class<?> effectiveClass(Object obj) {
        return obj instanceof HibernateProxy proxy
                ? proxy.getHibernateLazyInitializer().getPersistentClass()
                : obj.getClass();
    }
}
