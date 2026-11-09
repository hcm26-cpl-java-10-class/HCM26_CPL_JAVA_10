package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.exception.*;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.time.LocalDate;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import static com.example.starter_project_2025.system.training.TraineeImportContract.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ClassEnrollmentService {
    private final TrainingClassRepository classes;
    private final ClassEnrollmentRepository enrollments;
    private final MasterTraineeDirectory directory;
    private final Clock trainingClassClock;
    private static final Set<String> EDITABLE = Set.of("planning", "assigned", "active");
    private static final Pattern EMAIL = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    private record Validation(Preview preview, List<MasterTraineeDirectory.Profile> profiles) {}

    public List<TraineeView> list(Long classId, boolean sensitive) {
        requireClass(classId, false);
        var memberships = enrollments.findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(classId);
        if (memberships.isEmpty()) return List.of();
        var profiles = directory.load().stream().collect(Collectors.toMap(MasterTraineeDirectory.Profile::id, p -> p));
        return memberships.stream().map(e -> {
            var profile = profiles.get(e.getTraineeId());
            if (profile == null) throw new ExternalApiException("An enrolled profile cannot be resolved in the master directory.", 503, null);
            return new TraineeView(profile.id(), profile.studentId(), profile.studentId(), profile.fullName(), profile.personalEmail(),
                sensitive ? profile.nationalId() : null, profile.dob(), profile.gender(), statusLabel(e.getStatus()));
        }).toList();
    }

    public Preview preview(Long classId, List<Row> rows, boolean sensitive) {
        return validate(requireClass(classId, false), rows, sensitive).preview();
    }

    @Transactional
    public Imported importRows(Long classId, List<Row> rows, boolean sensitive) {
        // Every enrollment writer takes this same parent lock, including batch removal/status changes.
        var item = requireClass(classId, true);
        var result = validate(item, rows, sensitive);
        rejectInvalid(result.preview());
        insert(item, result.profiles());
        return new Imported(rows.size(), enrollments.occupiedSeats(classId));
    }

    @Transactional
    public BatchResult batch(Long classId, Batch batch, boolean sensitive) {
        var item = requireClass(classId, true);
        if (batch == null || batch.created() == null || batch.updated() == null || batch.deletedIds() == null
                || batch.created().size() + batch.updated().size() + batch.deletedIds().size() > 500)
            throw new BadRequestException("Provide created, updated and deletedIds arrays with at most 500 changes.");
        var current = enrollments.findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(classId).stream()
            .collect(Collectors.toMap(ClassEnrollment::getTraineeId, e -> e));
        Set<Long> changed = new HashSet<>();
        for (Long id : batch.deletedIds()) {
            var membership = current.get(id);
            if (membership == null || !changed.add(id)) throw new ConflictException("A selected enrollment no longer exists in this class or is duplicated.");
            membership.setIsActive(false);
        }
        for (StatusUpdate update : batch.updated()) {
            if (update == null || update.id() == null) throw new BadRequestException("Enrollment ID is required.");
            var membership = current.get(update.id());
            if (membership == null || !changed.add(update.id())) throw new ConflictException("A selected enrollment no longer exists in this class or is duplicated.");
            membership.setStatus(parseStatus(update.status()));
        }
        enrollments.flush();
        if (!batch.created().isEmpty()) {
            var validation = validate(item, batch.created(), sensitive);
            rejectInvalid(validation.preview()); insert(item, validation.profiles());
        }
        if (enrollments.occupiedSeats(classId) > item.getPlannedSize()) throw new ConflictException("Enrollment would exceed planned class capacity.");
        // A directory failure here rolls back the complete batch, including staged removals.
        return new BatchResult("Enrollment changes saved", list(classId, sensitive), enrollments.occupiedSeats(classId));
    }

    private Validation validate(TrainingClass item, List<Row> rows, boolean sensitive) {
        if (!EDITABLE.contains(item.getStatus())) throw new ConflictException("Enrollment changes are allowed only for planning, assigned or active classes.");
        if (rows == null || rows.isEmpty() || rows.size() > 500) throw new BadRequestException("Import between 1 and 500 trainee rows.");
        var pool = directory.load();
        var byCode = pool.stream().collect(Collectors.groupingBy(MasterTraineeDirectory.Profile::studentId));
        var existing = enrollments.findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(item.getId()).stream()
            .map(ClassEnrollment::getTraineeId).collect(Collectors.toSet());
        Map<String, Long> codeCounts = rows.stream().filter(Objects::nonNull).collect(Collectors.groupingBy(r -> clean(r.studentId()).toUpperCase(Locale.ROOT), Collectors.counting()));
        Set<Long> resolvedIds = new HashSet<>();
        List<RowResult> results = new ArrayList<>();
        List<MasterTraineeDirectory.Profile> resolved = new ArrayList<>();
        Set<Integer> rowNumbers = new HashSet<>();
        for (int i = 0; i < rows.size(); i++) {
            Row row = rows.get(i);
            int number = row == null || row.rowNumber() == null ? i + 2 : row.rowNumber();
            Map<String, List<String>> errors = new LinkedHashMap<>();
            boolean duplicate = false;
            if (row == null) { error(errors, "row", "A trainee row is required."); results.add(new RowResult(number, false, false, errors)); resolved.add(null); continue; }
            if (number < 2 || number > 100000 || !rowNumbers.add(number)) error(errors, "rowNumber", "Use a unique Excel row number between 2 and 100000.");
            String code = clean(row.studentId()).toUpperCase(Locale.ROOT);
            String fullName = clean(row.fullName());
            if (!code.matches("[A-Z0-9_-]{2,64}")) error(errors, "studentId", "FPT Student ID is required and must contain 2–64 letters, digits, underscores or hyphens.");
            if (fullName.isBlank() || fullName.length() > 100) error(errors, "fullName", "Full Name is required and must not exceed 100 characters.");
            if (!clean(row.personalEmail()).isEmpty() && (row.personalEmail().length() > 254 || !EMAIL.matcher(clean(row.personalEmail())).matches())) error(errors, "personalEmail", "Provide a valid email address or leave it blank.");
            if (!clean(row.nationalId()).isEmpty() && !sensitive) error(errors, "nationalId", "You do not have permission to supply National ID; leave it blank.");
            if (!clean(row.nationalId()).isEmpty() && !clean(row.nationalId()).matches("\\d{9,12}")) error(errors, "nationalId", "National ID must contain 9–12 digits if supplied.");
            if (!clean(row.dob()).isEmpty()) {
                try {
                    if (!row.dob().matches("\\d{4}-\\d{2}-\\d{2}") || LocalDate.parse(row.dob()).isAfter(LocalDate.now(trainingClassClock))) throw new IllegalArgumentException();
                } catch (RuntimeException ex) { error(errors, "dob", "DOB must be a valid past date in YYYY-MM-DD format."); }
            }
            if (!clean(row.gender()).isEmpty() && !Set.of("male", "female", "other").contains(clean(row.gender()).toLowerCase(Locale.ROOT))) error(errors, "gender", "Gender must be Male, Female or Other.");
            if (!code.isEmpty() && codeCounts.getOrDefault(code, 0L) > 1) { error(errors, "studentId", "Duplicate Student ID within the file."); duplicate = true; }
            var matches = byCode.getOrDefault(code, List.of());
            MasterTraineeDirectory.Profile profile = matches.size() == 1 ? matches.getFirst() : null;
            if (profile == null) error(errors, "studentId", matches.isEmpty() ? "Student ID is not present in the master directory; new profiles are not created by import."
                : "Student ID is ambiguous in the master directory.");
            else {
                if (!Set.of("active", "studying").contains(profile.status().toLowerCase(Locale.ROOT))) error(errors, "studentId", "The student is not active or eligible for enrollment.");
                if (!fullName.equalsIgnoreCase(profile.fullName())) error(errors, "fullName", "Full Name does not match the existing student profile.");
                compare(errors, "personalEmail", row.personalEmail(), profile.personalEmail());
                compare(errors, "nationalId", row.nationalId(), profile.nationalId());
                compare(errors, "dob", row.dob(), profile.dob());
                compare(errors, "gender", row.gender(), profile.gender());
                if (existing.contains(profile.id()) || !resolvedIds.add(profile.id())) {
                    error(errors, "studentId", "Student is already enrolled in this class or appears more than once in the import."); duplicate = true;
                }
            }
            results.add(new RowResult(number, errors.isEmpty(), duplicate, errors)); resolved.add(profile);
        }
        long candidates = results.stream().filter(RowResult::valid).count();
        if (enrollments.occupiedSeats(item.getId()) + candidates > item.getPlannedSize()) {
            results = results.stream().map(r -> {
                if (!r.valid()) return r;
                Map<String, List<String>> errors = new LinkedHashMap<>(r.errors());
                error(errors, "capacity", "Import would exceed planned class capacity.");
                return new RowResult(r.rowNumber(), false, r.duplicate(), errors);
            }).toList();
        }
        int valid = (int) results.stream().filter(RowResult::valid).count();
        return new Validation(new Preview(rows.size(), valid, rows.size() - valid,
            (int) results.stream().filter(RowResult::duplicate).count(), valid == rows.size(), results), resolved);
    }

    private void insert(TrainingClass item, List<MasterTraineeDirectory.Profile> profiles) {
        for (var profile : profiles) {
            var membership = enrollments.findByTrainingClass_IdAndTraineeId(item.getId(), profile.id()).orElseGet(ClassEnrollment::new);
            membership.setTrainingClass(item); membership.setTraineeId(profile.id());
            membership.setIsActive(true); membership.setStatus(ClassEnrollment.Status.ACTIVE); enrollments.save(membership);
        }
        enrollments.flush();
    }
    private TrainingClass requireClass(Long id, boolean lock) {
        var item = (lock ? classes.findForUpdate(id) : classes.findByIdAndIsActiveTrue(id))
            .orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        if (lock && !EDITABLE.contains(item.getStatus())) throw new ConflictException("This class no longer accepts enrollment changes.");
        return item;
    }
    private void rejectInvalid(Preview preview) {
        if (preview.canImport()) return;
        Map<String, List<String>> errors = new LinkedHashMap<>();
        preview.rows().forEach(row -> row.errors().forEach((field, messages) -> errors.put("rows[" + row.rowNumber() + "]." + field, messages)));
        throw new BusinessValidationException(errors);
    }
    private void compare(Map<String, List<String>> errors, String field, String supplied, String actual) {
        if (!clean(supplied).isEmpty() && !clean(supplied).equalsIgnoreCase(clean(actual))) error(errors, field, "Value does not match the existing student profile; import never updates personal information.");
    }
    private void error(Map<String, List<String>> errors, String field, String message) { errors.computeIfAbsent(field, k -> new ArrayList<>()).add(message); }
    private String clean(String value) { return value == null ? "" : value.trim(); }
    private ClassEnrollment.Status parseStatus(String status) {
        return switch (clean(status)) {
            case "Active" -> ClassEnrollment.Status.ACTIVE;
            case "Inactive" -> ClassEnrollment.Status.INACTIVE;
            case "Dropped Out" -> ClassEnrollment.Status.DROPPED_OUT;
            default -> throw new BadRequestException("Status must be Active, Inactive or Dropped Out.");
        };
    }
    private String statusLabel(ClassEnrollment.Status status) {
        return switch (status) { case ACTIVE -> "Active"; case INACTIVE -> "Inactive"; case DROPPED_OUT -> "Dropped Out"; };
    }
}
