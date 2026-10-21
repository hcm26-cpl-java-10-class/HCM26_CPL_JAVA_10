package com.example.starter_project_2025.system.demo.certificate;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CertificateRepository extends BaseCrudRepository<Certificate, Long> {
}
