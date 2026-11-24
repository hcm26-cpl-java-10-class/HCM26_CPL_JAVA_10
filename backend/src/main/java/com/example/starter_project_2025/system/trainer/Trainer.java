package com.example.starter_project_2025.system.trainer;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.subject.Subject;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import org.hibernate.proxy.HibernateProxy;

import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Pattern;

/** Internal identity namespace. Never equate this ID to a shared-system trainer ID. */
@Entity
@Table(name = "trainers", uniqueConstraints = {
    @UniqueConstraint(name = "uk_trainer_code", columnNames = "trainer_code"),
    @UniqueConstraint(name = "uk_trainer_email", columnNames = "email")
})
@Getter
@ResourcePermission("TRAINER")
@ResourceMenu(title = "Trainers", group = "Training Management", icon = "users", url = "/trainers", order = 7, permission = "TRAINER_READ")
public class Trainer extends BaseEntity {

    public static final int MAX_CODE_LENGTH = 20;
    public static final int MAX_FULL_NAME_LENGTH = 80;
    public static final int MAX_EMAIL_LENGTH = 100;
    public static final int MAX_SPECIALIZATION_LENGTH = 200;

    public static final String CODE_REGEX = "[A-Za-z0-9][A-Za-z0-9_-]{0,19}";
    public static final String EMAIL_REGEX = "^[^\\s@]+@[^\\s@.]+(\\.[^\\s@.]+)+$";

    private static final Pattern CODE_PATTERN = Pattern.compile(CODE_REGEX);
    private static final Pattern EMAIL_PATTERN = Pattern.compile(EMAIL_REGEX);

    @Column(name = "trainer_code", nullable = false, length = MAX_CODE_LENGTH)
    private String trainerCode;

    @Column(nullable = false, length = MAX_FULL_NAME_LENGTH)
    private String fullName;

    @Column(nullable = false, length = MAX_EMAIL_LENGTH)
    private String email;

    @Column(length = MAX_SPECIALIZATION_LENGTH)
    private String specialization;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TrainerStatus status = TrainerStatus.ACTIVE;

    @Getter(AccessLevel.NONE)
    @ManyToMany
    @JoinTable(
        name = "trainer_teaching_topics",
        joinColumns = @JoinColumn(name = "trainer_id"),
        inverseJoinColumns = @JoinColumn(name = "subject_id")
    )
    private Set<Subject> teachingTopics = new LinkedHashSet<>();

    /** Required by JPA/Hibernate; domain callers should use {@link #create}. */
    protected Trainer() {
    }

    public static Trainer create(
            String trainerCode,
            String fullName,
            String email,
            String specialization,
            TrainerStatus status,
            Collection<Subject> teachingTopics
    ) {
        Trainer trainer = new Trainer();
        trainer.isActive = true;
        trainer.applyProfile(trainerCode, fullName, email, specialization, status, teachingTopics);
        return trainer;
    }

    /** Prevents mutating an already-assigned database identity while keeping BaseEntity compatible. */
    @Override
    public void setId(Long id) {
        if (this.id != null && !Objects.equals(this.id, id)) {
            throw new UnsupportedOperationException("Trainer ID cannot be changed once assigned.");
        }
        this.id = id;
    }

    /** Prevents reactivating an archived trainer via inherited BaseEntity setter. */
    @Override
    public void setIsActive(Boolean isActive) {
        if (isArchived() && Boolean.TRUE.equals(isActive)) {
            throw new ConflictException("Archived trainer cannot be reactivated.");
        }
        if (Boolean.FALSE.equals(isActive)) {
            archive();
            return;
        }
        this.isActive = Boolean.TRUE;
    }

    public void updateProfile(
            String trainerCode,
            String fullName,
            String email,
            String specialization,
            TrainerStatus status,
            Collection<Subject> teachingTopics
    ) {
        requireNotArchived("update");
        applyProfile(trainerCode, fullName, email, specialization, status, teachingTopics);
    }

    public void changeStatus(TrainerStatus newStatus) {
        requireNotArchived("change status of");
        if (newStatus == null) {
            throw new BadRequestException("Status is required.");
        }
        this.status = newStatus;
    }

    public void activate() {
        changeStatus(TrainerStatus.ACTIVE);
    }

    public void deactivate() {
        changeStatus(TrainerStatus.INACTIVE);
    }

    /** Soft-archive: preserves historical identity while enforcing INACTIVE status. */
    public void archive() {
        this.isActive = false;
        this.status = TrainerStatus.INACTIVE;
    }

    public boolean isArchived() {
        return !Boolean.TRUE.equals(this.isActive);
    }

    public boolean isActiveTrainer() {
        return Boolean.TRUE.equals(this.isActive) && this.status == TrainerStatus.ACTIVE;
    }

    public Set<Subject> getTeachingTopics() {
        return Collections.unmodifiableSet(this.teachingTopics);
    }

    public boolean canTeachTopic(Long subjectId) {
        if (subjectId == null) {
            return false;
        }
        return this.teachingTopics.stream().anyMatch(subject -> subjectId.equals(subject.getId()));
    }

    @PrePersist
    @PreUpdate
    void ensureValidState() {
        if (this.status == null) {
            this.status = TrainerStatus.ACTIVE;
        }
        if (isArchived()) {
            this.status = TrainerStatus.INACTIVE;
        }
    }

    /** Validates and normalizes every input before mutating any field (atomic state update). */
    private void applyProfile(
            String trainerCode,
            String fullName,
            String email,
            String specialization,
            TrainerStatus status,
            Collection<Subject> teachingTopics
    ) {
        String normalizedCode = requireMaxLength(requireNonBlank(trainerCode, "Trainer Code"), MAX_CODE_LENGTH, "Trainer Code")
                .toUpperCase(Locale.ROOT);
        if (!CODE_PATTERN.matcher(normalizedCode).matches()) {
            throw new BadRequestException("Trainer Code must start with a letter or digit and use only letters, digits, '_' or '-'.");
        }
        String normalizedName = requireMaxLength(requireNonBlank(fullName, "Full Name"), MAX_FULL_NAME_LENGTH, "Full Name");
        String normalizedEmail = requireMaxLength(requireNonBlank(email, "Work Email"), MAX_EMAIL_LENGTH, "Work Email")
                .toLowerCase(Locale.ROOT);
        if (!EMAIL_PATTERN.matcher(normalizedEmail).matches()) {
            throw new BadRequestException("Work Email must be a valid email address.");
        }
        String normalizedSpec = requireMaxLength(specialization == null ? "" : specialization.trim(), MAX_SPECIALIZATION_LENGTH, "Specialization");
        if (status == null) {
            throw new BadRequestException("Status is required.");
        }
        Set<Subject> normalizedTopics = new LinkedHashSet<>();
        if (teachingTopics != null) {
            for (Subject subject : teachingTopics) {
                if (subject == null) {
                    throw new BadRequestException("Teaching Topics cannot contain null.");
                }
                normalizedTopics.add(subject);
            }
        }

        // All checks passed — commit state atomically.
        this.trainerCode = normalizedCode;
        this.fullName = normalizedName;
        this.email = normalizedEmail;
        this.specialization = normalizedSpec;
        this.status = status;
        this.teachingTopics.clear();
        this.teachingTopics.addAll(normalizedTopics);
    }

    private void requireNotArchived(String action) {
        if (isArchived()) {
            throw new ConflictException("Cannot " + action + " an archived trainer.");
        }
    }

    private static String requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(fieldName + " is required.");
        }
        return value.trim();
    }

    private static String requireMaxLength(String value, int maxLength, String fieldName) {
        if (value.length() > maxLength) {
            throw new BadRequestException(fieldName + " must not exceed " + maxLength + " characters.");
        }
        return value;
    }

    @Override
    public final boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (other == null) {
            return false;
        }
        Class<?> thisEffectiveClass = effectiveClass(this);
        Class<?> otherEffectiveClass = effectiveClass(other);
        if (thisEffectiveClass != otherEffectiveClass) {
            return false;
        }
        Trainer that = (Trainer) other;
        Long thisId = this.getId();
        return thisId != null && Objects.equals(thisId, that.getId());
    }

    @Override
    public final int hashCode() {
        return effectiveClass(this).hashCode();
    }

    private static Class<?> effectiveClass(Object obj) {
        return obj instanceof HibernateProxy proxy
                ? proxy.getHibernateLazyInitializer().getPersistentClass()
                : obj.getClass();
    }
}
