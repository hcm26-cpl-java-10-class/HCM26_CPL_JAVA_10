package com.example.starter_project_2025.system.demo.subject;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SubjectRepository extends BaseCrudRepository<Subject, Long> {

    Optional<Subject> findByCode(String code);

    boolean existsByCode(String code);
}
