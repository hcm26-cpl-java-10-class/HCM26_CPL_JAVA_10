package com.example.starter_project_2025.system.demo.certificate.insights;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.time.LocalDate;
import java.util.*;

import static com.example.starter_project_2025.system.demo.certificate.insights.CertificateInsightsDTO.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CertificateInsightsService {

    private final CertificateInsightsRepository repository;

    public Overview getOverview() {
        List<Object[]> rows = repository.getOverview();

        if (rows == null || rows.isEmpty()) {
            return new Overview(0, 0, 0, 0, 0);
        }

        Object[] row = rows.get(0);

        long certificates = number(row[0]);
        long learners = number(row[1]);
        long courses = number(row[2]);
        long departments = number(row[3]);

        double average = learners == 0
                ? 0
                : (double) certificates / learners;

        return new Overview(
                certificates,
                learners,
                courses,
                departments,
                round(average)
        );
    }

    public HeatmapResponse getHeatmap() {

        // 1. Lấy số lượng nhân viên của từng phòng ban.
        List<Object[]> employeeRows =
                repository.getDepartmentEmployeeCounts();

        Map<Long, DepartmentItem> departmentMap =
                new LinkedHashMap<>();

        for (Object[] row : employeeRows) {
            Long departmentId = number(row[0]);

            departmentMap.put(
                    departmentId,
                    new DepartmentItem(
                            departmentId,
                            string(row[1]),
                            number(row[2])
                    )
            );
        }

        // 2. Lấy các cặp phòng ban - kỹ năng đã có chứng chỉ.
        List<Object[]> coverageRows =
                repository.getDepartmentSkillCoverage();

        Map<Long, SkillItem> skillMap =
                new LinkedHashMap<>();

        Set<Long> representedDepartmentIds =
                new LinkedHashSet<>();

        List<DepartmentSkillCoverage> cells =
                new ArrayList<>();

        for (Object[] row : coverageRows) {

            Long departmentId = number(row[0]);
            Long categoryId = number(row[2]);

            DepartmentItem department =
                    departmentMap.get(departmentId);

            if (department == null) {
                continue;
            }

            long certifiedEmployees = number(row[5]);

            // Không tạo ô không có chứng chỉ.
            if (certifiedEmployees <= 0) {
                continue;
            }

            representedDepartmentIds.add(departmentId);

            skillMap.putIfAbsent(
                    categoryId,
                    new SkillItem(
                            categoryId,
                            string(row[3]),
                            string(row[4])
                    )
            );

            long certificateCount = number(row[6]);

            double coverage = department.totalEmployees() == 0
                    ? 0
                    : certifiedEmployees * 100.0
                    / department.totalEmployees();

            cells.add(new DepartmentSkillCoverage(
                    departmentId,
                    department.departmentName(),
                    department.totalEmployees(),
                    categoryId,
                    string(row[3]),
                    string(row[4]),
                    certifiedEmployees,
                    certificateCount,
                    round(coverage)
            ));
        }

        // 3. Chỉ giữ phòng ban đã có chứng chỉ.
        List<DepartmentItem> departments =
                representedDepartmentIds.stream()
                        .map(departmentMap::get)
                        .filter(Objects::nonNull)
                        .toList();

        return new HeatmapResponse(
                new ArrayList<>(skillMap.values()),
                departments,
                cells
        );
    }

    /*
     * Chi tiết một ô heatmap.
     */
    public CellDetailResponse getCellDetail(
            Long departmentId,
            Long categoryId
    ) {

        DepartmentSkillCoverage summary =
                getHeatmap().cells().stream()
                        .filter(cell ->
                                Objects.equals(
                                        cell.departmentId(),
                                        departmentId
                                )
                                        && Objects.equals(
                                        cell.categoryId(),
                                        categoryId
                                )
                        )
                        .findFirst()
                        .orElseThrow(() ->
                                new ResponseStatusException(
                                        HttpStatus.NOT_FOUND,
                                        "No certificate data found"
                                )
                        );

        // Các khóa học có chứng chỉ.
        List<CourseBreakdown> courses =
                repository.getCellCourses(
                                departmentId,
                                categoryId
                        ).stream()
                        .map(row -> new CourseBreakdown(
                                number(row[0]),
                                string(row[1]),
                                number(row[2]),
                                number(row[3])
                        ))
                        .toList();

        // Các nhân viên sở hữu chứng chỉ.
        List<CertifiedLearner> learners =
                repository.getCellLearners(
                                departmentId,
                                categoryId
                        ).stream()
                        .map(row -> new CertifiedLearner(
                                number(row[0]),
                                string(row[1]),
                                string(row[2]),
                                number(row[3]),
                                toLocalDate(row[4])
                        ))
                        .toList();

        return new CellDetailResponse(
                summary,
                courses,
                learners
        );
    }

    private static long number(Object value) {
        if (value == null) {
            return 0L;
        }

        if (value instanceof Number number) {
            return number.longValue();
        }

        throw new IllegalStateException(
                "Expected Number but got "
                        + value.getClass().getName()
                        + "; value="
                        + (value instanceof Object[] array
                        ? Arrays.deepToString(array)
                        : value)
        );
    }

    private static String string(Object value) {
        return value == null ? "" : value.toString();
    }

    private static LocalDate toLocalDate(Object value) {
        if (value == null) {
            return null;
        }

        if (value instanceof LocalDate date) {
            return date;
        }

        if (value instanceof Date date) {
            return date.toLocalDate();
        }

        return LocalDate.parse(value.toString());
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
