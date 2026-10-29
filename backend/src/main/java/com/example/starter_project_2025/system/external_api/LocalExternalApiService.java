package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalRoomDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;

/** Standalone development data; never used as a fallback for a failed remote API. */
@Service
@Profile("local")
public class LocalExternalApiService implements ExternalApiService {
    private final ManagedClassDirectory managedClasses;
    private final ManagedTrainerDirectory managedTrainers;

    public LocalExternalApiService(ManagedClassDirectory managedClasses, ManagedTrainerDirectory managedTrainers) {
        this.managedClasses = managedClasses;
        this.managedTrainers = managedTrainers;
    }

    @Override
    public boolean isSampleData() {
        return true;
    }

    @Override
    public List<ExternalClassDTO> fetchClasses(String status) {
        return managedClasses.merge(List.of(
                sampleClass(1L, "LOCAL_JAVA_01", "Lớp Java mẫu 01", "active"),
                sampleClass(2L, "LOCAL_JAVA_02", "Lớp Java mẫu 02", "active"),
                sampleClass(3L, "LOCAL_JAVA_OLD", "Lớp Java mẫu đã kết thúc", "inactive")
        ).stream().filter(item -> matchesStatus(status, item.getStatus())).toList(), status);
    }

    @Override
    public ExternalClassDTO fetchClassById(Long id) {
        return fetchClasses(null).stream()
                .filter(item -> Objects.equals(item.getId(), id))
                .findFirst()
                .orElseThrow(() -> new ExternalApiException("Sample class not found: " + id, 404, null));
    }

    @Override
    public List<ExternalTrainerDTO> fetchTrainers(String status) {
        return managedTrainers.merge(List.of(
                new ExternalTrainerDTO(1L, "Giảng viên mẫu An", "trainer.an@example.com", "active"),
                new ExternalTrainerDTO(2L, "Giảng viên mẫu Bình", "trainer.binh@example.com", "active"),
                new ExternalTrainerDTO(3L, "Giảng viên mẫu đã nghỉ", "trainer.old@example.com", "inactive")
        ).stream().filter(item -> matchesStatus(status, item.getStatus())).toList(), status);
    }

    @Override
    public List<ExternalRoomDTO> fetchRooms() {
        return List.of(new ExternalRoomDTO(1L, "Phòng mẫu A101", 30),
                new ExternalRoomDTO(2L, "Phòng mẫu A102", 25));
    }

    private ExternalClassDTO sampleClass(Long id, String code, String name, String status) {
        return ExternalClassDTO.builder().id(id).code(code).name(name).status(status).plannedSize(25)
                .startDate("2026-01-01").endDate("2027-12-31").build();
    }

    private boolean matchesStatus(String requested, String actual) {
        return requested == null || requested.isBlank() || requested.equalsIgnoreCase(actual);
    }
}
