package com.example.starter_project_2025.system.management.student;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface StudentRepository extends BaseCrudRepository<Student, Long> {
    boolean existsByStudentCode(String studentCode);
    boolean existsByEmail(String email);
}
