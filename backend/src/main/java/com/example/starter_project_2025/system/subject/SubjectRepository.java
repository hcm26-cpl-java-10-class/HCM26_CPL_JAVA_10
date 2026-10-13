package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface SubjectRepository extends BaseCrudRepository<Subject, Long> {
}
