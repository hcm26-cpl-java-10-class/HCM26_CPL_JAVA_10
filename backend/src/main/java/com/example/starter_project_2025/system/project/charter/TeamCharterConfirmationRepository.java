package com.example.starter_project_2025.system.project.charter;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface TeamCharterConfirmationRepository extends JpaRepository<TeamCharterConfirmation, Long> {
    List<TeamCharterConfirmation> findByTeamIdAndRevisionNumber(Long teamId, Long revisionNumber);
}
