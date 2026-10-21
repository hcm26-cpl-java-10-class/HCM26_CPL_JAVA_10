package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

@Repository
public interface SubjectRepository extends BaseCrudRepository<Subject, Long> {

    @Query("""
            select (count(s) > 0) from Subject s
            where upper(trim(s.code)) = :code
              and lower(trim(s.version)) in :versions
              and (:excludedId is null or s.id <> :excludedId)
            """)
    boolean existsByNormalizedIdentity(
            @Param("code") String code,
            @Param("versions") List<String> versions,
            @Param("excludedId") Long excludedId);

    boolean existsByCodeAndVersion(String code, String version);

    boolean existsByCodeAndVersionAndIdNot(String code, String version, Long id);

    Optional<Subject> findByCodeAndVersion(String code, String version);

    List<Subject> findByIsActiveTrue();

    boolean existsByIdAndIsActiveTrue(Long id);

    List<Subject> findByIdInAndIsActiveTrue(java.util.Collection<Long> ids);
}
