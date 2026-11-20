
package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.demo.department.DepartmentMemberDTO;

import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends BaseCrudRepository<User, Long> {

    // Find user by email
    Optional<User> findByEmail(String email);

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCase(String email);

    // Find users by email domain
    List<User> findByEmailEndingWithIgnoreCase(String email);

    // Find active user by ID
    Optional<User> findByIdAndIsActiveTrue(Long id);

    // Find active users by tenant
    List<User> findByTenantIdAndIsActiveTrue(Long tenantId);

    // Lock users for contribution operations
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT u
            FROM User u
            WHERE u.id IN :ids
            ORDER BY u.id
            """)
    List<User> lockForContribution(@Param("ids") List<Long> ids);

    // Import: find accounts by multiple emails
    @Query("""
            SELECT u
            FROM User u
            WHERE LOWER(u.email) IN :emails
            """)
    List<User> findAllByEmailLowerIn(
            @Param("emails") Collection<String> emails
    );

    // Check whether a department is being used
    @Query("""
            SELECT (COUNT(u) > 0)
            FROM User u
            WHERE LOWER(TRIM(u.department)) = LOWER(TRIM(:code))
               OR LOWER(TRIM(u.department)) = LOWER(TRIM(:name))
            """)
    boolean existsByDepartmentCodeOrName(
            @Param("code") String code,
            @Param("name") String name
    );

    // Count users by active status
    Long countByIsActive(Boolean isActive);

    Long countByIsActiveAndLocked(Boolean isActive, Boolean locked);

    long countByRolesId(Long roleId);

    // Find active users by role name
    @Query("""
            SELECT DISTINCT u
            FROM User u
            JOIN u.roles r
            WHERE r.name = :roleName
              AND u.isActive = true
            """)
    List<User> findActiveUsersByRoleName(
            @Param("roleName") String roleName
    );

    // Find all users belonging to a department
    List<User> findAllByDepartments_Id(Long departmentId);

    // Count active students in a department
    @Query("""
            SELECT COUNT(DISTINCT u.id)
            FROM User u
            JOIN u.roles r
            JOIN u.departments d
            WHERE r.name = 'STUDENT'
              AND u.isActive = true
              AND d.id = :departmentId
            """)
    Long countActiveStudentsByDepartmentId(
            @Param("departmentId") Long departmentId
    );

    // Find active students in a department
    @Query("""
            SELECT DISTINCT u
            FROM User u
            JOIN u.roles r
            JOIN u.departments d
            WHERE r.name = 'STUDENT'
              AND u.isActive = true
              AND d.id = :departmentId
            ORDER BY u.firstName, u.lastName
            """)
    List<User> findActiveStudentsByDepartmentId(
            @Param("departmentId") Long departmentId
    );

    // Search active students in a department
    @Query(
            value = """
                    SELECT new com.example.starter_project_2025.system.demo.department.DepartmentMemberDTO(
                        u.id, u.email, u.firstName, u.lastName, d.id, d.name
                    )
                    FROM User u
                    JOIN u.departments d
                    JOIN u.roles r
                    WHERE d.id = :departmentId
                      AND u.isActive = true
                      AND r.name = 'STUDENT'
                      AND (
                          :search IS NULL
                          OR LOWER(COALESCE(u.firstName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                          OR LOWER(COALESCE(u.lastName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                          OR LOWER(COALESCE(u.email, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                      )
                    """,
            countQuery = """
                    SELECT COUNT(DISTINCT u.id)
                    FROM User u
                    JOIN u.departments d
                    JOIN u.roles r
                    WHERE d.id = :departmentId
                      AND u.isActive = true
                      AND r.name = 'STUDENT'
                      AND (
                          :search IS NULL
                          OR LOWER(COALESCE(u.firstName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                          OR LOWER(COALESCE(u.lastName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                          OR LOWER(COALESCE(u.email, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                      )
                    """
    )
    Page<DepartmentMemberDTO> searchActiveStudentsByDepartmentId(
            @Param("departmentId") Long departmentId,
            @Param("search") String search,
            Pageable pageable
    );

    // Search active students outside a department
    @Query(
            value = """
                    SELECT new com.example.starter_project_2025.system.demo.department.DepartmentMemberDTO(
                        u.id, u.email, u.firstName, u.lastName, d.id, d.name
                    )
                    FROM User u
                    LEFT JOIN u.departments d
                    JOIN u.roles r
                    WHERE u.isActive = true
                      AND r.name = 'STUDENT'
                      AND NOT EXISTS (
                          SELECT d2.id
                          FROM User otherUser
                          JOIN otherUser.departments d2
                          WHERE otherUser.id = u.id
                            AND d2.id = :departmentId
                      )
                      AND (
                          :search IS NULL
                          OR LOWER(COALESCE(u.firstName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                          OR LOWER(COALESCE(u.lastName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                          OR LOWER(COALESCE(u.email, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                      )
                    """,
            countQuery = """
                    SELECT COUNT(DISTINCT u.id)
                    FROM User u
                    JOIN u.roles r
                    WHERE u.isActive = true
                      AND r.name = 'STUDENT'
                      AND NOT EXISTS (
                          SELECT d2.id
                          FROM User otherUser
                          JOIN otherUser.departments d2
                          WHERE otherUser.id = u.id
                            AND d2.id = :departmentId
                      )
                      AND (
                          :search IS NULL
                          OR LOWER(COALESCE(u.firstName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                          OR LOWER(COALESCE(u.lastName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                          OR LOWER(COALESCE(u.email, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                      )
                    """
    )
    Page<DepartmentMemberDTO> searchActiveStudentsOutsideDepartment(
            @Param("departmentId") Long departmentId,
            @Param("search") String search,
            Pageable pageable
    );

    // Search all active students
    @Query(
            value = """
                    SELECT new com.example.starter_project_2025.system.demo.department.DepartmentMemberDTO(
                        u.id, u.email, u.firstName, u.lastName, d.id, d.name
                    )
                    FROM User u
                    LEFT JOIN u.departments d
                    JOIN u.roles r
                    WHERE u.isActive = true
                      AND r.name = 'STUDENT'
                      AND (
                          :search IS NULL
                          OR LOWER(COALESCE(u.firstName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                          OR LOWER(COALESCE(u.lastName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                          OR LOWER(COALESCE(u.email, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                      )
                    """,
            countQuery = """
                    SELECT COUNT(DISTINCT u.id)
                    FROM User u
                    JOIN u.roles r
                    WHERE u.isActive = true
                      AND r.name = 'STUDENT'
                      AND (
                          :search IS NULL
                          OR LOWER(COALESCE(u.firstName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                          OR LOWER(COALESCE(u.lastName, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                          OR LOWER(COALESCE(u.email, '')) LIKE LOWER(CONCAT('%', :search, '%'))
                      )
                    """
    )
    Page<DepartmentMemberDTO> searchActiveStudents(
            @Param("search") String search,
            Pageable pageable
    );

    // Find user IDs by actor name, full name or email
    @Query("""
            SELECT u.id
            FROM User u
            WHERE LOWER(
                CONCAT(
                    COALESCE(u.firstName, ''),
                    ' ',
                    COALESCE(u.lastName, '')
                )
            ) LIKE LOWER(CONCAT('%', :actorName, '%'))
            OR LOWER(COALESCE(u.email, ''))
                LIKE LOWER(CONCAT('%', :actorName, '%'))
            """)
    List<Long> findIdsByActorName(
            @Param("actorName") String actorName
    );

    // Count active students grouped by department
    @Query("""
            SELECT d.id, COUNT(DISTINCT u.id)
            FROM User u
            JOIN u.roles r
            JOIN u.departments d
            WHERE r.name = 'STUDENT'
              AND u.isActive = true
            GROUP BY d.id
            """)
    List<Object[]> countActiveStudentsPerDepartment();
}
