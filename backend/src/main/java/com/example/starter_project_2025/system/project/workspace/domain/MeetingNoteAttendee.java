package com.example.starter_project_2025.system.project.workspace.domain;

import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "meeting_note_attendees",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_meeting_note_attendee_user",
                columnNames = {"meeting_note_id", "user_id"}),
        indexes = @Index(name = "idx_meeting_note_attendee_user", columnList = "user_id"))
@Getter
@Setter
@NoArgsConstructor
public class MeetingNoteAttendee {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "meeting_note_id", nullable = false)
    private ProjectLog meetingNote;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    public static MeetingNoteAttendee create(ProjectLog meetingNote, User user) {
        MeetingNoteAttendee attendee = new MeetingNoteAttendee();
        attendee.meetingNote = meetingNote;
        attendee.user = user;
        return attendee;
    }
}
