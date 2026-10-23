package com.example.starter_project_2025.system.rbac.user;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
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

    Optional<User> findByUsernameIgnoreCase(String username);

    Optional<User> findByEmployeeCodeIgnoreCase(String employeeCode);

    Long countByIsActive(Boolean isActive);

    long countByRolesId(Long roleId);

    /**
     * Lấy các user đang hoạt động có role cụ thể (ví dụ STUDENT), sắp xếp theo email.
     * Dùng cho danh sách chọn nhanh khi tạo lời mời hàng loạt.
     */
    @Query("""
            select distinct u from User u
            join u.roles r
            where r.name = :roleName
              and u.isActive = true
            order by u.email asc
            """)
    List<User> findActiveUsersByRoleName(@Param("roleName") String roleName);
}
