package com.example.starter_project_2025.system.demo.certificate.insights;

import com.example.starter_project_2025.system.demo.certificate.Certificate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CertificateInsightsRepository
        extends JpaRepository<Certificate, Long> {

    /*
     * Tổng quan chứng chỉ.
     */
    @Query(value = """
        SELECT
            COUNT(DISTINCT c.id),
            COUNT(DISTINCT c.user_id),
            COUNT(DISTINCT c.course_id),
            COUNT(DISTINCT ud.department_id)
        FROM certificates c
        LEFT JOIN user_departments ud
            ON ud.user_id = c.user_id
        """, nativeQuery = true)
    List<Object[]> getOverview();

    /*
     * Tổng số nhân viên theo phòng ban.
     */
    @Query(value = """
        SELECT
            d.id,
            d.name,
            COUNT(DISTINCT ud.user_id)
        FROM departments d
        LEFT JOIN user_departments ud
            ON ud.department_id = d.id
        GROUP BY d.id, d.name
        ORDER BY d.name
        """, nativeQuery = true)
    List<Object[]> getDepartmentEmployeeCounts();

    /*
     * Chỉ lấy các cặp Department × Skill đã có chứng chỉ.
     *
     * certified_employees:
     * Số nhân viên khác nhau có chứng chỉ trong nhóm kỹ năng.
     *
     * certificate_count:
     * Tổng số chứng chỉ được cấp trong nhóm kỹ năng.
     */
    @Query(value = """
        SELECT
            d.id AS department_id,
            d.name AS department_name,
            COALESCE(parent.id, cat.id) AS category_id,
            COALESCE(parent.code, cat.code) AS skill_code,
            COALESCE(parent.name, cat.name) AS skill_name,
            COUNT(DISTINCT cert.user_id) AS certified_employees,
            COUNT(DISTINCT cert.id) AS certificate_count
        FROM certificates cert
        JOIN users u
            ON u.id = cert.user_id
        JOIN user_departments ud
            ON ud.user_id = u.id
        JOIN departments d
            ON d.id = ud.department_id
        JOIN courses course
            ON course.id = cert.course_id
        JOIN course_category cc
            ON cc.course_id = course.id
        JOIN categories cat
            ON cat.id = cc.category_id
        LEFT JOIN categories parent
            ON parent.id = cat.parent_id
        GROUP BY
            d.id,
            d.name,
            COALESCE(parent.id, cat.id),
            COALESCE(parent.code, cat.code),
            COALESCE(parent.name, cat.name)
        HAVING COUNT(DISTINCT cert.user_id) > 0
        ORDER BY d.name, skill_name
        """, nativeQuery = true)
    List<Object[]> getDepartmentSkillCoverage();

    /*
     * Danh sách khóa học thuộc nhóm kỹ năng
     * mà nhân viên của phòng ban đã sở hữu chứng chỉ.
     */
    @Query(value = """
        SELECT
            course.id,
            course.name,
            COUNT(DISTINCT cert.id),
            COUNT(DISTINCT cert.user_id)
        FROM certificates cert
        JOIN users u
            ON u.id = cert.user_id
        JOIN user_departments ud
            ON ud.user_id = u.id
        JOIN courses course
            ON course.id = cert.course_id
        JOIN course_category cc
            ON cc.course_id = course.id
        JOIN categories cat
            ON cat.id = cc.category_id
        LEFT JOIN categories parent
            ON parent.id = cat.parent_id
        WHERE ud.department_id = :departmentId
          AND COALESCE(parent.id, cat.id) = :categoryId
        GROUP BY course.id, course.name
        ORDER BY course.name
        """, nativeQuery = true)
    List<Object[]> getCellCourses(
            @Param("departmentId") Long departmentId,
            @Param("categoryId") Long categoryId
    );

    /*
     * Danh sách nhân viên có chứng chỉ trong nhóm kỹ năng.
     */
    @Query(value = """
        SELECT
            u.id,
            TRIM(CONCAT(
                COALESCE(u.first_name, ''),
                ' ',
                COALESCE(u.last_name, '')
            )),
            u.email,
            COUNT(DISTINCT cert.id),
            MAX(cert.issued_at)
        FROM certificates cert
        JOIN users u
            ON u.id = cert.user_id
        JOIN user_departments ud
            ON ud.user_id = u.id
        JOIN courses course
            ON course.id = cert.course_id
        JOIN course_category cc
            ON cc.course_id = course.id
        JOIN categories cat
            ON cat.id = cc.category_id
        LEFT JOIN categories parent
            ON parent.id = cat.parent_id
        WHERE ud.department_id = :departmentId
          AND COALESCE(parent.id, cat.id) = :categoryId
        GROUP BY
            u.id,
            u.first_name,
            u.last_name,
            u.email
        ORDER BY u.first_name, u.last_name
        """, nativeQuery = true)
    List<Object[]> getCellLearners(
            @Param("departmentId") Long departmentId,
            @Param("categoryId") Long categoryId
    );
}
