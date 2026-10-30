package com.example.starter_project_2025.system.external_api;

import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalRoomDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassRequest;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.exception.ConflictException;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Locale;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/** Standalone development data; never used as a fallback for a failed remote API. */
@Service
@Profile("local")
public class LocalExternalApiService implements ExternalApiService {
    private final ConcurrentHashMap<Long, ExternalClassDTO> classes = new ConcurrentHashMap<>();
    private final AtomicLong classIds = new AtomicLong(3);

    public LocalExternalApiService() {
        classes.put(1L, ExternalClassDTO.builder().id(1L).code("LOCAL_JAVA_01").name("Lớp Java mẫu 01")
                .startDate("2026-10-01").endDate("2027-01-31").status("active")
                .plannedSize(25).enrolledCount(18)
                .deliveryType("Class").traineeType("Fresher").formatType("Offline").skills("Java, Spring Boot")
                .site("TP. Hồ Chí Minh").location("F-Town 3, Phòng A101").subjectType("IT Technical")
                .scope("Unit").supplierPartner("SCM").jobRecommendation(false).build());
        classes.put(2L, ExternalClassDTO.builder().id(2L).code("LOCAL_JAVA_02").name("Lớp Java mẫu 02")
                .startDate("2026-11-15").endDate("2027-03-15").status("active")
                .plannedSize(30).enrolledCount(0)
                .deliveryType("Class").traineeType("Fresher").formatType("Hybrid").skills("Java, React")
                .site("TP. Hồ Chí Minh").location("QTSC 9, Phòng A102").subjectType("IT Technical")
                .scope("Unit").supplierPartner("SCM").jobRecommendation(false).build());
        classes.put(3L, ExternalClassDTO.builder().id(3L).code("LOCAL_JAVA_OLD").name("Lớp Java mẫu đã kết thúc")
                .startDate("2026-03-01").endDate("2026-07-31").status("inactive")
                .plannedSize(25).enrolledCount(24)
                .deliveryType("Class").traineeType("Fresher").formatType("Offline").skills("Java")
                .site("Hà Nội").location("F-Ville 2, Hòa Lạc").subjectType("IT Technical")
                .scope("Unit").supplierPartner("SCM").jobRecommendation(false).build());
    }

    @Override
    public boolean isSampleData() {
        return true;
    }

    @Override
    public List<ExternalClassDTO> fetchClasses(String status) {
        return new ArrayList<>(classes.values()).stream().sorted(Comparator.comparing(ExternalClassDTO::getId))
                .filter(item -> matchesStatus(status, item.getStatus())).toList();
    }

    @Override
    public ExternalClassDTO fetchClassById(Long id) {
        ExternalClassDTO classData = classes.get(id);
        if (classData == null) throw new ExternalApiException("Sample class not found: " + id, 404, null);
        return classData;
    }

    @Override
    public synchronized ExternalClassDTO createClass(ExternalClassRequest request) {
        ensureUniqueCode(request.code(), null);
        long id = classIds.incrementAndGet();
        ExternalClassDTO classData = toClass(id, request, null, 0);
        classes.put(id, classData);
        return classData;
    }

    @Override
    public synchronized ExternalClassDTO updateClass(Long id, ExternalClassRequest request) {
        ExternalClassDTO current = fetchClassById(id);
        ensureUniqueCode(request.code(), id);
        ExternalClassDTO updated = toClass(id, request, current.getProgramId(),
                current.getEnrolledCount() == null ? 0 : current.getEnrolledCount());
        classes.put(id, updated);
        return updated;
    }

    @Override
    public synchronized void deleteClass(Long id) {
        if (classes.remove(id) == null) throw new ExternalApiException("Sample class not found: " + id, 404, null);
    }

    @Override
    public List<ExternalTrainerDTO> fetchTrainers(String status) {
        return List.of(
                new ExternalTrainerDTO(1L, "Giảng viên mẫu An", "trainer.an@example.com", "active"),
                new ExternalTrainerDTO(2L, "Giảng viên mẫu Bình", "trainer.binh@example.com", "active"),
                new ExternalTrainerDTO(3L, "Giảng viên mẫu đã nghỉ", "trainer.old@example.com", "inactive")
        ).stream().filter(item -> matchesStatus(status, item.getStatus())).toList();
    }

    @Override
    public List<ExternalRoomDTO> fetchRooms() {
        return List.of(new ExternalRoomDTO(1L, "Phòng mẫu A101", 30),
                new ExternalRoomDTO(2L, "Phòng mẫu A102", 25));
    }

    private ExternalClassDTO toClass(Long id, ExternalClassRequest request, Long programId, Integer enrolledCount) {
        return ExternalClassDTO.builder().id(id).code(request.code().trim()).name(request.name().trim())
                .programId(programId).startDate(blankToNull(request.startDate())).endDate(blankToNull(request.endDate()))
                .status(request.status().toLowerCase(Locale.ROOT)).plannedSize(request.plannedSize())
                .enrolledCount(enrolledCount)
                .deliveryType(request.deliveryType()).traineeType(request.traineeType())
                .formatType(request.formatType()).skills(request.skills()).site(request.site())
                .location(request.location()).subjectType(request.subjectType()).scope(request.scope())
                .supplierPartner(request.supplierPartner()).keyProgram(request.keyProgram())
                .jobRecommendation(request.jobRecommendation()).build();
    }

    private void ensureUniqueCode(String code, Long ignoredId) {
        boolean duplicate = classes.values().stream().anyMatch(item -> !Objects.equals(item.getId(), ignoredId)
                && item.getCode().equalsIgnoreCase(code.trim()));
        if (duplicate) throw new ConflictException("Mã lớp đã tồn tại: " + code.trim());
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private boolean matchesStatus(String requested, String actual) {
        return requested == null || requested.isBlank() || requested.equalsIgnoreCase(actual);
    }
}
