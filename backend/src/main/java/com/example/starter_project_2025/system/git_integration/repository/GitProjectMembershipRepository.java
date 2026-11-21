package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

/**
 * GI-06: who belongs to a master project and its modules. A member is an active member of an
 * active team whose project is in the scope, or whose team is assigned to a module of it.
 * Kept inside Git Integration so the project module's repositories are not changed for it.
 */
public interface GitProjectMembershipRepository extends Repository<ProjectMember, Long> {

    /** One member of one team; a person in several teams of the scope has several rows. */
    interface MemberRow {
        Long getUserId();
        String getFirstName();
        String getLastName();
        String getEmail();
        String getRole();
        Long getProjectId();
    }

    @Query("""
            select u.id as userId, u.firstName as firstName, u.lastName as lastName, u.email as email,
                   pm.role as role, t.project.id as projectId
              from ProjectMember pm join pm.team t join pm.classMember cm join cm.user u
             where pm.isActive = true and cm.isActive = true and cm.status = :memberStatus
               and t.isActive = true and t.status = :teamStatus and t.project.id in :scope""")
    List<MemberRow> membersOfTeamProjects(@Param("scope") Collection<Long> scope,
                                          @Param("memberStatus") ClassMemberStatus memberStatus,
                                          @Param("teamStatus") ProjectTeamStatus teamStatus);

    @Query("""
            select u.id as userId, u.firstName as firstName, u.lastName as lastName, u.email as email,
                   pm.role as role, a.project.id as projectId
              from TeamSubprojectAssignment a join a.team t, ProjectMember pm join pm.classMember cm join cm.user u
             where pm.team = t and a.isActive = true and a.project.id in :scope
               and pm.isActive = true and cm.isActive = true and cm.status = :memberStatus
               and t.isActive = true and t.status = :teamStatus""")
    List<MemberRow> membersOfAssignedTeams(@Param("scope") Collection<Long> scope,
                                           @Param("memberStatus") ClassMemberStatus memberStatus,
                                           @Param("teamStatus") ProjectTeamStatus teamStatus);

    /** Mentors of the active teams of the scope (directly or through a module assignment). */
    @Query("""
            select count(t) > 0 from ProjectTeam t
             where t.assignedMentorId = :userId and t.isActive = true and t.status = :teamStatus
               and (t.project.id in :scope
                    or exists (select a.id from TeamSubprojectAssignment a
                                where a.team = t and a.isActive = true and a.project.id in :scope))""")
    boolean isMentorOfScope(@Param("userId") Long userId, @Param("scope") Collection<Long> scope,
                            @Param("teamStatus") ProjectTeamStatus teamStatus);
}
