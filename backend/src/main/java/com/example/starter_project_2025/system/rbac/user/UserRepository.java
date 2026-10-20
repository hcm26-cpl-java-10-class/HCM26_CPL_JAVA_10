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
import java.util.UUID;

@Repository
public interface UserRepository extends BaseCrudRepository<User, Long> {

    Optional<User> findByEmail(String email);

    boolean existsByEmail(String email);

    Long countByIsActive(Boolean isActive);

    boolean existsByDepartment_Id(Long departmentId);

    List<User> findAllByDepartment_IdAndIsActiveTrue(
            Long departmentId
    );

    @Query("select distinct u from User u join u.roles role "
            + "where u.department.id = :departmentId and u.isActive = true "
            + "and role.name = 'STUDENT' order by u.firstName, u.lastName")
    List<User> findActiveStudentsByDepartmentId(
            @Param("departmentId") Long departmentId
    );

    @Query("select count(distinct u.id) from User u join u.roles role "
            + "where u.department.id = :departmentId and u.isActive = true "
            + "and role.name = 'STUDENT'")
    long countActiveStudentsByDepartmentId(
            @Param("departmentId") Long departmentId
    );

    @Query(
            value = "select new com.example.starter_project_2025.system.demo.department.DepartmentMemberDTO("
                    + "u.id, u.email, u.firstName, u.lastName, department.id, department.name) "
                    + "from User u left join u.department department "
                    + "where department.id = :departmentId and u.isActive = true "
                    + "and exists (select role.id from User member join member.roles role "
                    + "where member.id = u.id and role.name = 'STUDENT') "
                    + "and (:search is null or lower(u.email) like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.firstName, '')) "
                    + "like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.lastName, '')) "
                    + "like lower(concat('%', :search, '%')))",
            countQuery = "select count(u) from User u where u.department.id = :departmentId "
                    + "and u.isActive = true and exists (select role.id from User member "
                    + "join member.roles role where member.id = u.id and role.name = 'STUDENT') "
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
                    + "u.id, u.email, u.firstName, u.lastName, department.id, department.name) "
                    + "from User u left join u.department department "
                    + "where (department is null or department.id <> :departmentId) "
                    + "and u.isActive = true and exists (select role.id from User member "
                    + "join member.roles role where member.id = u.id and role.name = 'STUDENT') "
                    + "and (:search is null or lower(u.email) like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.firstName, '')) "
                    + "like lower(concat('%', :search, '%')) "
                    + "or lower(coalesce(u.lastName, '')) "
                    + "like lower(concat('%', :search, '%')))",
            countQuery = "select count(u) from User u left join u.department department "
                    + "where (department is null or department.id <> :departmentId) "
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
}
