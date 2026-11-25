package com.example.starter_project_2025.system.notification.template;

import com.example.starter_project_2025.system.notification.NotificationCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EmailTemplateRepository extends JpaRepository<EmailTemplate, Long> {

    Optional<EmailTemplate> findByTenantIdAndCodeIgnoreCase(Long tenantId, String code);

    boolean existsByTenantIdAndCodeIgnoreCase(Long tenantId, String code);

    @Query("""
            select t from EmailTemplate t
            where t.tenantId in :tenantIds
              and (:category is null or t.category = :category)
              and (:active is null or t.active = :active)
              and (:keyword is null or lower(t.code) like lower(concat('%', :keyword, '%'))
                   or lower(t.name) like lower(concat('%', :keyword, '%')))
            """)
    Page<EmailTemplate> search(
            @Param("tenantIds") List<Long> tenantIds,
            @Param("category") NotificationCategory category,
            @Param("active") Boolean active,
            @Param("keyword") String keyword,
            Pageable pageable
    );
}
