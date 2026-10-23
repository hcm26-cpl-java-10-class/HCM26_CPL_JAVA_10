package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.rbac.user.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TeamMemberRepository extends JpaRepository<TeamMember, Long> {

    List<TeamMember> findByUser(User user);

    boolean existsByTeamIdAndUserId(Long teamId, Long userId);
}

