package com.example.starter_project_2025.system.rbac.location;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface LocationRepository extends BaseCrudRepository<Location, Long> {

    // Tìm danh sách nút con theo ID của nút cha (Spring Data JPA tự hiểu thuộc tính parent.id)
    List<Location> findByParentId(Long parentId);

    // Tìm tất cả các nút gốc (Root Locations - không có parent)
    List<Location> findByParentIsNull();

    // Kiểm tra trùng code
    boolean existsByCode(String code);

    // Kiểm tra xem vị trí cha này có vị trí con nào không
    boolean existsByParentId(Long parentId);

    // Tìm vị trí theo code
    Optional<Location> findByCode(String code);
}