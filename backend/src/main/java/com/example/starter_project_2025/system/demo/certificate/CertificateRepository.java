package com.example.starter_project_2025.system.demo.certificate;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Repository
public interface CertificateRepository extends BaseCrudRepository<Certificate, Long> {
    boolean existsByUser_IdAndCourse_Id(Long userId, Long courseId);
    Optional<Certificate> findByVerificationToken(UUID verificationToken);
    List<Certificate> findAllByUser_Id(Long userId);

    @Query("select c.user.id from Certificate c where c.course.id = :courseId")
    Set<Long> findUserIdsByCourseId(@Param("courseId") Long courseId);
}
