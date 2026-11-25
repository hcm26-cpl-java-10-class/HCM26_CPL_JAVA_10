package com.example.starter_project_2025.system.exam.supervisor.signaling;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

@Component
@RequiredArgsConstructor
public class ExamSupervisorSignalingHandler extends TextWebSocketHandler {

    private static final int MAX_MESSAGE_CHARS = 64 * 1024;

    private final ObjectMapper objectMapper;

    private final ConcurrentHashMap<Long, Room> rooms =
            new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session)
            throws Exception {

        var ticket = (ExamSupervisorSignalingTicketService.SignalingTicket)
                session.getAttributes().get(
                        ExamSupervisorWebSocketHandshakeInterceptor.TICKET_ATTRIBUTE
                );

        if (ticket == null) {
            session.close(CloseStatus.NOT_ACCEPTABLE);
            return;
        }

        session.getAttributes().put("attemptId", ticket.attemptId());
        session.getAttributes().put("role", ticket.role());

        Room room = rooms.computeIfAbsent(
                ticket.attemptId(),
                ignored -> new Room()
        );

        synchronized (room) {

            if ("STUDENT".equals(ticket.role())) {

                closeIfOpen(room.student);
                room.student = session;

            } else {

                closeIfOpen(room.supervisor);
                room.supervisor = session;
            }

            // Student luôn là bên tạo offer.
            if (room.student != null
                    && room.supervisor != null
                    && room.student.isOpen()
                    && room.supervisor.isOpen()) {

                send(room.student, "request-offer", null);
            }
        }
    }

    @Override
    protected void handleTextMessage(
            WebSocketSession session,
            TextMessage message
    ) throws Exception {

        if (message.getPayloadLength() > MAX_MESSAGE_CHARS) {
            session.close(CloseStatus.TOO_BIG_TO_PROCESS);
            return;
        }

        JsonNode json;

        try {
            json = objectMapper.readTree(message.getPayload());
        } catch (Exception ex) {
            session.close(CloseStatus.BAD_DATA);
            return;
        }

        String type = json.path("type").asText();

        if (!("offer".equals(type)
                || "answer".equals(type)
                || "ice".equals(type))) {

            session.close(CloseStatus.NOT_ACCEPTABLE);
            return;
        }

        Long attemptId =
                (Long) session.getAttributes().get("attemptId");

        String role =
                (String) session.getAttributes().get("role");

        Room room = attemptId == null
                ? null
                : rooms.get(attemptId);

        if (room == null) {
            return;
        }

        WebSocketSession target =
                "STUDENT".equals(role)
                        ? room.supervisor
                        : room.student;

        if (target != null && target.isOpen()) {
            synchronized (target) {
                target.sendMessage(
                        new TextMessage(message.getPayload())
                );
            }
        }
    }

    @Override
    public void afterConnectionClosed(
            WebSocketSession session,
            CloseStatus status
    ) {

        Long attemptId =
                (Long) session.getAttributes().get("attemptId");

        String role =
                (String) session.getAttributes().get("role");

        if (attemptId == null) {
            return;
        }

        Room room = rooms.get(attemptId);

        if (room == null) {
            return;
        }

        synchronized (room) {

            if ("STUDENT".equals(role) && room.student == session) {

                room.student = null;
                send(room.supervisor, "peer-left", null);

            } else if ("SUPERVISOR".equals(role)
                    && room.supervisor == session) {

                room.supervisor = null;
                send(room.student, "peer-left", null);
            }

            if (room.student == null && room.supervisor == null) {
                rooms.remove(attemptId, room);
            }
        }
    }

    private void send(
            WebSocketSession session,
            String type,
            JsonNode payload
    ) {

        if (session == null || !session.isOpen()) {
            return;
        }

        try {

            var node = objectMapper.createObjectNode()
                    .put("type", type);

            if (payload != null) {
                node.set("payload", payload);
            }

            synchronized (session) {
                session.sendMessage(
                        new TextMessage(
                                objectMapper.writeValueAsString(node)
                        )
                );
            }

        } catch (IOException ignored) {
        }
    }

    private void closeIfOpen(WebSocketSession session) {

        if (session != null && session.isOpen()) {

            try {
                session.close(CloseStatus.NORMAL);
            } catch (IOException ignored) {
            }
        }
    }

    private static final class Room {
        private WebSocketSession student;
        private WebSocketSession supervisor;
    }
}