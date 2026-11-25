package com.example.starter_project_2025.system.project.charter;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface TeamCharterResponsibilityRepository extends JpaRepository<TeamCharterResponsibility, Long> {
    List<TeamCharterResponsibility> findByTeamId(Long teamId);
}
