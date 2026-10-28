package com.example.starter_project_2025.system.project.workspace.repository;

import com.example.starter_project_2025.system.project.workspace.domain.MeetingNoteAttendee;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface MeetingNoteAttendeeRepository extends JpaRepository<MeetingNoteAttendee, Long> {
    @EntityGraph(attributePaths = "user")
    List<MeetingNoteAttendee> findAllByMeetingNote_IdIn(Collection<Long> meetingNoteIds);

    @Query("""
            select attendee
            from MeetingNoteAttendee attendee
            where attendee.meetingNote.id = :meetingNoteId
            order by attendee.user.id
            """)
    @EntityGraph(attributePaths = "user")
    List<MeetingNoteAttendee> findAllByMeetingNoteId(@Param("meetingNoteId") Long meetingNoteId);

    boolean existsByMeetingNote_IdAndUser_Id(Long meetingNoteId, Long userId);
}
