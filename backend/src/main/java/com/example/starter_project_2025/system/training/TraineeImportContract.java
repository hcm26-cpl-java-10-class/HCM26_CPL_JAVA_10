package com.example.starter_project_2025.system.training;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;
import java.util.Map;

public final class TraineeImportContract {
    private TraineeImportContract() {}
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Row(Integer rowNumber, String studentId, String fullName, String personalEmail,
                      String nationalId, String dob, String gender, String status) {
        public Row(Integer rowNumber, String studentId, String fullName, String personalEmail,
                   String nationalId, String dob, String gender) {
            this(rowNumber, studentId, fullName, personalEmail, nationalId, dob, gender, "Active");
        }
        @Override public String toString() { return "TraineeImportRow[rowNumber=" + rowNumber + "]"; }
    }
    public record RowResult(int rowNumber, boolean valid, boolean duplicate, Map<String, List<String>> errors) {}
    public record Preview(int totalRows, int validRows, int invalidRows, int duplicateRows,
                          boolean canImport, List<RowResult> rows) {}
    public record Imported(int importedCount, long enrolledTrainees) {}
    public record StatusUpdate(Long id, String status) {}
    public record Batch(List<Row> created, List<StatusUpdate> updated, List<Long> deletedIds) {
        @Override public String toString() { return "ClassEnrollmentBatch[profile values omitted]"; }
    }
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record TraineeView(Long id, String code, String fptAccount, String fullName,
                              String personalEmail, String nationalId, String dob, String gender, String status) {
        @Override public String toString() { return "EnrolledTrainee[profile values omitted]"; }
    }
    public record BatchResult(String message, List<TraineeView> trainees, long enrolledTrainees) {}
}
