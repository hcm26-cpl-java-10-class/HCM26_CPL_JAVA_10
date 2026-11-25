package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.demo.department.DepartmentMemberDTO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends BaseCrudRepository<User, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id in :ids order by u.id")
    List<User> lockForContribution(@Param("ids") java.util.Collection<Long> ids);

    Optional<User> findByEmail(String email);
    Optional<User> findByEmailIgnoreCase(String email);

    List<User> findByEmailEndingWithIgnoreCase(String emailSuffix);

    List<User> findByTenantIdAndIsActiveTrue(Long tenantId);

    Optional<User> findByIdAndIsActiveTrue(Long id);

    boolean existsByEmail(String email);

    boolean existsByUserCode(String userCode);

    /** Profile affiliations are scalar values; accept a department code or display name. */
    @Query("""
            select (count(u) > 0) from User u
            where lower(trim(u.department)) = lower(trim(:code))
               or lower(trim(u.department)) = lower(trim(:name))
            """)
    boolean existsByDepartmentCodeOrName(@Param("code") String code, @Param("name") String name);

    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findByEmployeeCodeIgnoreCase(String employeeCode);

    Long countByIsActive(Boolean isActive);

    /** Number of ACTIVE accounts: active and not locked. */
    Long countByIsActiveAndLocked(Boolean isActive, Boolean locked);

    List<User> findAllByDepartments_Id(Long departmentId);

    List<User> findAllByDepartments_IdAndIsActiveTrue(Long departmentId);

    @Query("select distinct u from User u join u.roles role "
            + "join u.departments department "
            + "where department.id = :departmentId and u.isActive = true "
            + "and role.name = 'STUDENT' order by u.firstName, u.lastName")
    List<User> findActiveStudentsByDepartmentId(
            @Param("departmentId") Long departmentId
    );

    @Query("select count(distinct u.id) from User u join u.roles role "
            + "join u.departments department "
            + "where department.id = :departmentId and u.isActive = true "
            + "and role.name = 'STUDENT'")
    long countActiveStudentsByDepartmentId(
            @Param("departmentId") Long departmentId
    );

    @Query(
            value = "select new com.example.starter_project_2025.system.demo.department.DepartmentMemberDTO("
                    + "u.id, u.email, u.firstName, u.lastName, department.id, department.name) "
                    + "from User u join u.departments department "
                    + "where department.id = :departmentId and u.isActive = true "
                    + "and exists (select role.id from User member join member.roles role "
                    + "where member.id = u.id and role.name = 'STUDENT') "
                    + "and (:search is null or lower(u.email) like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.firstName, '')) "
                    + "like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.lastName, '')) "
                    + "like lower(concat('%', :search, '%')))",
            countQuery = "select count(u) from User u where u.isActive = true "
                    + "and exists (select department.id from User member "
                    + "join member.departments department where member.id = u.id "
                    + "and department.id = :departmentId) "
                    + "and exists (select role.id from User member join member.roles role "
                    + "where member.id = u.id and role.name = 'STUDENT') "
                    + "and (:search is null or lower(u.email) like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.firstName, '')) "
                    + "like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.lastName, '')) "
                    + "like lower(concat('%', :search, '%')))"
    )
    Page<DepartmentMemberDTO> searchActiveStudentsByDepartmentId(
            @Param("departmentId") Long departmentId,
            @Param("search") String search,
            Pageable pageable
    );

    @Query(
            value = "select new com.example.starter_project_2025.system.demo.department.DepartmentMemberDTO("
                    + "u.id, u.email, u.firstName, u.lastName, null, null) "
                    + "from User u "
                    + "where u.isActive = true and exists (select role.id from User member "
                    + "join member.roles role where member.id = u.id and role.name = 'STUDENT') "
                    + "and (:search is null or lower(u.email) like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.firstName, '')) "
                    + "like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.lastName, '')) "
                    + "like lower(concat('%', :search, '%')))",
            countQuery = "select count(u) from User u "
                    + "where u.isActive = true and exists (select role.id from User member "
                    + "join member.roles role where member.id = u.id and role.name = 'STUDENT') "
                    + "and (:search is null or lower(u.email) like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.firstName, '')) "
                    + "like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.lastName, '')) "
                    + "like lower(concat('%', :search, '%')))"
    )
    Page<DepartmentMemberDTO> searchActiveStudents(
            @Param("search") String search,
            Pageable pageable
    );

    @Query(
            value = "select new com.example.starter_project_2025.system.demo.department.DepartmentMemberDTO("
                    + "u.id, u.email, u.firstName, u.lastName, null, null) "
                    + "from User u "
                    + "where not exists (select department.id from User member "
                    + "join member.departments department where member.id = u.id "
                    + "and department.id = :departmentId) "
                    + "and u.isActive = true and exists (select role.id from User member "
                    + "join member.roles role where member.id = u.id and role.name = 'STUDENT') "
                    + "and (:search is null or lower(u.email) like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.firstName, '')) "
                    + "like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.lastName, '')) "
                    + "like lower(concat('%', :search, '%')))",
            countQuery = "select count(u) from User u "
                    + "where not exists (select department.id from User member "
                    + "join member.departments department where member.id = u.id "
                    + "and department.id = :departmentId) "
                    + "and u.isActive = true and exists (select role.id from User member "
                    + "join member.roles role where member.id = u.id and role.name = 'STUDENT') "
                    + "and (:search is null or lower(u.email) like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.firstName, '')) "
                    + "like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.lastName, '')) "
                    + "like lower(concat('%', :search, '%')))"
    )
    Page<DepartmentMemberDTO> searchActiveStudentsOutsideDepartment(
            @Param("departmentId") Long departmentId,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("select department.id, count(distinct u.id) from User u join u.roles role "
            + "join u.departments department "
            + "where u.isActive = true and role.name = 'STUDENT' group by department.id")
    List<Object[]> countActiveStudentsPerDepartment();

    long countByRolesId(Long roleId);

    @Query("""
    SELECT u.id
    FROM User u
    WHERE LOWER(CONCAT(
        COALESCE(u.firstName, ''), ' ',
        COALESCE(u.lastName, '')
    )) LIKE LOWER(CONCAT('%', :keyword, '%'))
       OR LOWER(COALESCE(u.firstName, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
       OR LOWER(COALESCE(u.lastName, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
       OR LOWER(COALESCE(u.email, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
    """)
    List<Long> findIdsByActorName(@Param("keyword") String keyword);

    @Query("""
            select distinct u from User u
            join u.roles r
            where r.name = :roleName
              and u.isActive = true
            order by u.email asc
            """)
    List<User> findActiveUsersByRoleName(@Param("roleName") String roleName);
}
