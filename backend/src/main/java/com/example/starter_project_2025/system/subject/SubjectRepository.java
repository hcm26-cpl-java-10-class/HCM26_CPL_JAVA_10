package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SubjectRepository extends BaseCrudRepository<Subject, Long> {
import java.util.List;
import java.util.Optional;

@Repository
public interface SubjectRepository extends BaseCrudRepository<Subject, Long> {

    boolean existsByCodeAndVersion(String code, String version);

    boolean existsByCodeAndVersionAndIdNot(String code, String version, Long id);

    Optional<Subject> findByCodeAndVersion(String code, String version);

    List<Subject> findByIsActiveTrue();

    boolean existsByIdAndIsActiveTrue(Long id);

    List<Subject> findByIdInAndIsActiveTrue(java.util.Collection<Long> ids);
}
