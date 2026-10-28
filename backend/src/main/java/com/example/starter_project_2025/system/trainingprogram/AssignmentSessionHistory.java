package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.schedule.ScheduleEntryKey;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.*;

/** A read model over both sources. UNION ALL retains equal numeric IDs in different tables. */
@Repository
@RequiredArgsConstructor
public class AssignmentSessionHistory {
    private final NamedParameterJdbcTemplate jdbc;
    private static final String ROWS = """
        (select 'DEMO_SESSION' as source, id, teaching_assignment_id, class_id, trainer_id,
                title, start_time as starts, end_time as ends, location, room_id, meeting_url, status, is_active
           from sessions
         union all
         select 'STUDY_SESSION' as source, id, teaching_assignment_id, class_id, trainer_id,
                title, cast(concat(session_date, ' ', start_time) as timestamp) as starts,
                cast(concat(session_date, ' ', end_time) as timestamp) as ends,
                room as location, room_id, meeting_url, status, is_active
           from study_sessions) history
        """;
    public long count(Long assignmentId) {
        return jdbc.queryForObject("select count(*) from " + ROWS + " where teaching_assignment_id=:id",
                Map.of("id", assignmentId), Long.class);
    }
    public List<Row> blocking(LocalDateTime from, LocalDateTime to) {
        return jdbc.query("select * from " + ROWS + " where is_active=true and status<>'CANCELLED' and starts<:to and ends>:from",
                Map.of("from",from,"to",to),(rs,index)->row(rs));
    }
    public Page<TeachingAssignmentSessionResponse> sessions(Long id, Session.SessionStatus status, Pageable page) {
        var params = new HashMap<String, Object>(); params.put("id", id);
        String where = " where teaching_assignment_id=:id";
        if (status != null) { where += " and status=:status"; params.put("status", status.name()); }
        return query(where, params, page).map(Row::summary);
    }
    public Page<Row> impacts(Long id, boolean trainerChanged, Long classId, Long trainerId,
                             LocalDateTime from, LocalDateTime until, Pageable page) {
        var params = new HashMap<String, Object>();
        params.put("id", id); params.put("changed", trainerChanged); params.put("classId", classId);
        params.put("trainerId", trainerId); params.put("from", from); params.put("until", until);
        return query("""
            where teaching_assignment_id=:id and
              (:changed=true or (status <> 'CANCELLED' and
                (class_id is null or class_id<>:classId or trainer_id is null or trainer_id<>:trainerId
                 or starts<:from or (cast(:until as timestamp) is not null and ends>=:until))))
            """, params, page);
    }
    private Page<Row> query(String where, Map<String,Object> params, Pageable page) {
        Map<String,String> columns = Map.of("id","id","startTime","starts","endTime","ends","status","status");
        var order = new ArrayList<String>();
        for (Sort.Order item : page.getSort()) {
            String column = columns.get(item.getProperty());
            if (column == null) throw new IllegalArgumentException("Unsupported session sort field.");
            order.add(column + (item.isAscending() ? " asc" : " desc"));
        }
        order.add("source asc"); order.add("id asc");
        long total = jdbc.queryForObject("select count(*) from " + ROWS + where, params, Long.class);
        params.put("limit",page.getPageSize()); params.put("offset",page.getOffset());
        var content = jdbc.query("select * from " + ROWS + where + " order by " + String.join(",",order)
                + " limit :limit offset :offset",params,(rs,index)->row(rs));
        return new PageImpl<>(content,page,total);
    }
    private Row row(ResultSet rs) throws SQLException {
        return new Row(rs.getObject("class_id",Long.class),rs.getObject("trainer_id",Long.class),
                new TeachingAssignmentSessionResponse(rs.getLong("id"),rs.getString("title"),
                        rs.getTimestamp("starts").toLocalDateTime(),rs.getTimestamp("ends").toLocalDateTime(),
                        rs.getString("location"),rs.getObject("room_id",Long.class),rs.getString("meeting_url"),
                        Session.SessionStatus.valueOf(rs.getString("status")),rs.getBoolean("is_active"),
                        ScheduleEntryKey.Source.valueOf(rs.getString("source"))));
    }
    public record Row(Long classId, Long trainerId, TeachingAssignmentSessionResponse summary) {}
}
