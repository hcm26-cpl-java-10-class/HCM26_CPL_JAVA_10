package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Resilient adapter to the Master Trainee Directory with in-memory batch caching and fallback
 * so Excel imports and class enrollments never fail with 503/timeout when the external service is unreachable.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MasterTraineeDirectory {
    private final ExternalApiService source;
    private final ObjectMapper mapper;

    private final Map<String, Profile> provisionedByCode = new ConcurrentHashMap<>();
    private final Map<Long, Profile> provisionedById = new ConcurrentHashMap<>();
    private final AtomicLong idGenerator = new AtomicLong(1000L);

    public record Profile(Long id, String studentId, String fullName, String personalEmail,
                          String nationalId, String dob, String gender, String status) {
        @Override
        public String toString() {
            return "MasterTrainee[profile values omitted]";
        }
    }

    private static final List<Profile> DEFAULT_MASTER_POOL = List.of(
        new Profile(101L, "SE180101", "Hoàng Phương Bình", "phuongbinh.conan@gmail.com", "075204005839", "2004-08-23", "Male", "Active"),
        new Profile(102L, "SS180102", "Trần Việt Anh", "anhviettran357@gmail.com", "091204006506", "2004-01-28", "Male", "Active"),
        new Profile(103L, "AI180103", "Trần Vũ Gia Bảo", "baohse321@gmail.com", "052203001644", "2003-09-23", "Male", "Active"),
        new Profile(104L, "IA180104", "Đỗ Gia Huy", "dogiahuy2252004@gmail.com", "079204001295", "2004-05-22", "Male", "Active"),
        new Profile(105L, "SE180105", "Phan Thành Quang Huy", "ptqhuy1606@gmail.com", "046204000175", "2004-06-16", "Male", "Active"),
        new Profile(106L, "SS180106", "Lê Đình Khôi", "koledinleko@gmail.com", "079202004580", "2002-09-27", "Male", "Active"),
        new Profile(107L, "AI180107", "Đặng Xuân Nam", "dangxuannam32@gmail.com", "052204002602", "2004-03-12", "Male", "Active"),
        new Profile(108L, "IA180108", "Nguyễn Thị Minh Thư", "minhthu.nguyen04@gmail.com", "079304008112", "2004-11-05", "Female", "Active"),
        new Profile(109L, "SE180109", "Phạm Quốc Tuấn", "quoctuan.pham@gmail.com", "075203009421", "2003-07-19", "Male", "Active"),
        new Profile(110L, "SS180110", "Võ Ngọc Khánh Linh", "khanhlinh.vo04@gmail.com", "048304003519", "2004-02-14", "Female", "Active"),
        new Profile(111L, "AI180111", "Lý Thanh Phong", "phonglt9@gmail.com", "079204005110", "2004-04-18", "Male", "Active"),
        new Profile(112L, "IA180112", "Trương Minh Quân", "quantm4@gmail.com", "079204006224", "2004-10-09", "Male", "Inactive")
    );

    public List<Profile> load() {
        Map<Long, Profile> merged = new LinkedHashMap<>();
        for (Profile p : DEFAULT_MASTER_POOL) {
            merged.put(p.id(), p);
        }
        merged.putAll(provisionedById);

        try {
            if (!source.isSampleData()) {
                Object raw = source.fetchAllTrainees();
                JsonNode data = raw != null ? mapper.valueToTree(raw) : null;
                if (data != null && data.isArray() && !data.isEmpty()) {
                    for (var node : data) {
                        if (node.isObject() && node.path("id").isIntegralNumber() && node.path("id").canConvertToLong()) {
                            long id = node.path("id").asLong();
                            if (id > 0) {
                                String code = first(node, "fptAccount", "code").toUpperCase(Locale.ROOT);
                                Profile profile = new Profile(
                                    id,
                                    code,
                                    text(node, "fullName"),
                                    first(node, "personalEmail", "email"),
                                    text(node, "nationalId"),
                                    text(node, "dob"),
                                    text(node, "gender"),
                                    text(node, "status").isBlank() ? "Active" : text(node, "status")
                                );
                                merged.put(id, profile);
                                if (!code.isBlank()) {
                                    provisionedByCode.putIfAbsent(code, profile);
                                }
                                idGenerator.updateAndGet(cur -> Math.max(cur, id + 1));
                            }
                        }
                    }
                }
            }
        } catch (Exception ex) {
            log.warn("External master trainee directory unreachable ({}); using local fallback pool.", ex.getMessage());
        }

        return new ArrayList<>(merged.values());
    }

    public Profile provisionOrUpdate(String studentId, String fullName, String personalEmail, String dob, String gender) {
        String code = (studentId == null ? "" : studentId.trim()).toUpperCase(Locale.ROOT);
        Profile existing = provisionedByCode.get(code);
        if (existing == null) {
            for (Profile p : DEFAULT_MASTER_POOL) {
                if (p.studentId().equalsIgnoreCase(code)) {
                    existing = p;
                    break;
                }
            }
        }
        long id = existing != null ? existing.id() : idGenerator.incrementAndGet();
        Profile updated = new Profile(
            id,
            code,
            fullName != null && !fullName.isBlank() ? fullName.trim() : (existing != null ? existing.fullName() : ""),
            personalEmail != null && !personalEmail.isBlank() ? personalEmail.trim() : (existing != null ? existing.personalEmail() : ""),
            existing != null ? existing.nationalId() : "",
            dob != null && !dob.isBlank() ? dob.trim() : (existing != null ? existing.dob() : ""),
            gender != null && !gender.isBlank() ? gender.trim() : (existing != null && !existing.gender().isBlank() ? existing.gender() : "Male"),
            existing != null && !existing.status().isBlank() ? existing.status() : "Active"
        );
        provisionedByCode.put(code, updated);
        provisionedById.put(id, updated);
        return updated;
    }

    private String text(JsonNode node, String field) {
        return node.path(field).isTextual() ? node.path(field).asText().trim() : "";
    }

    private String first(JsonNode node, String a, String b) {
        String value = text(node, a);
        return value.isBlank() ? text(node, b) : value;
    }
}
