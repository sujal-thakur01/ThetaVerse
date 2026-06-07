package com.interview.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.interview.backend.dto.SignalingMessage;
import com.interview.backend.service.LiveSessionService;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
public class SignalingHandler extends TextWebSocketHandler {

    private static final long STUDENT_DISCONNECT_GRACE_MS = 8000;
    private static final int CLOSE_CODE_GOING_AWAY = 1001;
    private static final ScheduledExecutorService DISCONNECT_CLEANUP_EXECUTOR = Executors
            .newSingleThreadScheduledExecutor();

    private final LiveSessionService sessionService;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public SignalingHandler(LiveSessionService sessionService) {
        this.sessionService = sessionService;
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        SignalingMessage sm = objectMapper.readValue(message.getPayload(), SignalingMessage.class);
        String sessionCode = sm.getSessionCode();
        String senderId = firstNonBlank(sm.getParticipantId(), sm.getHostId());
        String participantName = firstNonBlank(sm.getParticipantName(), sm.getName());

        switch (sm.getType()) {
            case "HOST_JOIN":
                sessionService.registerHostWebSocket(sessionCode, senderId, session);
                broadcastToHost(sessionCode, "PARTICIPANTS_UPDATE", sessionService.getStudents(sessionCode));
                break;

            case "STUDENT_JOIN":
                LiveSessionService.Participant p = sessionService.addStudent(sessionCode, participantName, session);
                if (p != null) {
                    sendToSession(session, buildMessage("JOIN_SUCCESS", p.getId(), p));
                    broadcastToHost(sessionCode, "PARTICIPANTS_UPDATE", sessionService.getStudents(sessionCode));
                    sendToSession(session, buildMessage("HOST_MEDIA_PERMISSION_UPDATE", null,
                            sessionService.getHostMediaPermissions(sessionCode)));
                } else {
                    sendToSession(session, buildMessage("ERROR", null, "Invalid Session Code"));
                }
                break;

            case "ADMIT":
                if (!sessionService.isHost(sessionCode, senderId)) {
                    sendToSession(session, buildMessage("ERROR", null, "Only host can admit participants"));
                    break;
                }

                int admittedCount = sessionService.countAdmittedStudents(sessionCode);
                int capacity = sessionService.getSessionCapacity(sessionCode);
                if (admittedCount >= capacity) {
                    sendToSession(session,
                            buildMessage("ERROR", null,
                                    "Session is at full capacity. Increase capacity or remove a participant."));
                    broadcastToHost(sessionCode, "SESSION_CAPACITY_UPDATE", buildCapacityPayload(sessionCode));
                    break;
                }

                boolean admitted = sessionService.admitStudent(sessionCode, sm.getTargetId());
                broadcastToHost(sessionCode, "PARTICIPANTS_UPDATE", sessionService.getStudents(sessionCode));
                broadcastToHost(sessionCode, "SESSION_CAPACITY_UPDATE", buildCapacityPayload(sessionCode));
                if (admitted) {
                    sendToTarget(sessionCode, sm.getTargetId(), buildMessage("ADMITTED", null, null));
                } else {
                    sendToSession(session,
                            buildMessage("ERROR", null,
                                    "Participant could not be admitted. They may no longer be connected."));
                }
                break;

            case "REJECT":
                if (!sessionService.isHost(sessionCode, senderId)) {
                    sendToSession(session, buildMessage("ERROR", null, "Only host can reject participants"));
                    break;
                }
                WebSocketSession targetSession = sessionService.getTargetSession(sessionCode, sm.getTargetId());

                if (targetSession != null && targetSession.isOpen()) {
                    try {
                        targetSession.sendMessage(
                                new TextMessage(objectMapper.writeValueAsString(buildMessage("REJECTED", null, null))));
                    } catch (IOException ioException) {
                        // Ignore notify failures so host-side removal still completes.
                    }
                }

                sessionService.rejectStudent(sessionCode, sm.getTargetId());
                broadcastToHost(sessionCode, "PARTICIPANTS_UPDATE", sessionService.getStudents(sessionCode));
                broadcastToHost(sessionCode, "SESSION_CAPACITY_UPDATE", buildCapacityPayload(sessionCode));
                break;

            case "REMOVE_STUDENT":
                if (!sessionService.isHost(sessionCode, senderId)) {
                    sendToSession(session, buildMessage("ERROR", null, "Only host can remove participants"));
                    break;
                }

                LiveSessionService.Participant removedStudent = sessionService.removeStudent(sessionCode,
                        sm.getTargetId());
                if (removedStudent == null) {
                    sendToSession(session, buildMessage("ERROR", null, "Participant could not be removed"));
                    break;
                }

                WebSocketSession removedSession = removedStudent.getSession();
                if (removedSession != null && removedSession.isOpen()) {
                    try {
                        removedSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(
                                buildMessage("REJECTED", null, null))));
                    } catch (IOException ignored) {
                        // Removal should continue even if the student socket is already closing.
                    }
                }

                sendPeerDisconnectedToHost(sessionCode, removedStudent.getId());
                broadcastToHost(sessionCode, "PARTICIPANTS_UPDATE", sessionService.getStudents(sessionCode));
                broadcastToHost(sessionCode, "SESSION_CAPACITY_UPDATE", buildCapacityPayload(sessionCode));
                broadcastToAdmittedStudents(sessionCode, "PARTICIPANTS_UPDATE",
                        sessionService.getStudents(sessionCode));
                break;

            case "SET_CAPACITY":
                if (!sessionService.isHost(sessionCode, senderId)) {
                    sendToSession(session, buildMessage("ERROR", null, "Only host can set capacity"));
                    break;
                }

                Integer requestedCapacity = parseCapacity(sm.getPayload());
                if (requestedCapacity == null) {
                    sendToSession(session, buildMessage("ERROR", null, "Capacity must be an integer between 1 and 5"));
                    break;
                }
                if (requestedCapacity < 1 || requestedCapacity > 5) {
                    sendToSession(session, buildMessage("ERROR", null, "Capacity must be between 1 and 5"));
                    break;
                }

                sessionService.setSessionCapacity(sessionCode, requestedCapacity);
                broadcastToHost(sessionCode, "SESSION_CAPACITY_UPDATE", buildCapacityPayload(sessionCode));
                break;

            case "HOST_MEDIA_PERMISSION":
                if (!sessionService.isHost(sessionCode, senderId)) {
                    sendToSession(session, buildMessage("ERROR", null, "Only host can change media permissions"));
                    break;
                }
                boolean videoEnabled = getBoolean(sm.getPayload(), "videoEnabled");
                boolean audioEnabled = getBoolean(sm.getPayload(), "audioEnabled");
                boolean screenEnabled = getBoolean(sm.getPayload(), "screenEnabled");
                sessionService.updateHostMediaPermissions(sessionCode, videoEnabled, audioEnabled, screenEnabled);
                broadcastToHost(sessionCode, "HOST_MEDIA_PERMISSION_UPDATE",
                        sessionService.getHostMediaPermissions(sessionCode));
                broadcastToAdmittedStudents(sessionCode, "HOST_MEDIA_PERMISSION_UPDATE",
                        sessionService.getHostMediaPermissions(sessionCode));
                break;

            case "OFFER":
            case "ANSWER":
            case "ICE_CANDIDATE":
                if (sessionService.canSignalBetween(sessionCode, senderId, sm.getTargetId())) {
                    boolean delivered = sendToTarget(sessionCode, sm.getTargetId(), sm);
                    if (!delivered) {
                        sendToSession(session, buildMessage("ERROR", null, "Target participant is not connected"));
                    }
                } else {
                    sendToSession(session, buildMessage("ERROR", null, "Unauthorized signaling route"));
                }
                break;

            case "MEDIA_TOGGLE":
                if (!sessionService.canSignalBetween(sessionCode, senderId, sm.getTargetId())) {
                    sendToSession(session, buildMessage("ERROR", null, "Unauthorized signaling route"));
                    break;
                }
                if (!sendToTarget(sessionCode, sm.getTargetId(), buildMediaToggleMessage(sm, senderId))) {
                    sendToSession(session, buildMessage("ERROR", null, "Target participant is not connected"));
                }
                break;
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        LiveSessionService.Participant disconnected = sessionService.handleDisconnect(session.getId());
        if (disconnected != null && "STUDENT".equals(disconnected.getRole()) && disconnected.getSessionCode() != null) {
            String sessionCode = disconnected.getSessionCode();
            String participantId = disconnected.getId();
            boolean removeImmediately = status != null && status.getCode() == CLOSE_CODE_GOING_AWAY;

            if (removeImmediately) {
                handleConfirmedStudentDisconnect(sessionCode, participantId);
                return;
            }

            DISCONNECT_CLEANUP_EXECUTOR.schedule(() -> {
                handleConfirmedStudentDisconnect(sessionCode, participantId);
            }, STUDENT_DISCONNECT_GRACE_MS, TimeUnit.MILLISECONDS);
        }
    }

    private void handleConfirmedStudentDisconnect(String sessionCode, String participantId) {
        boolean removed = sessionService.removeStudentIfStillDisconnected(sessionCode, participantId);
        if (!removed) {
            return;
        }

        try {
            sendPeerDisconnectedToHost(sessionCode, participantId);
            broadcastToHost(sessionCode, "PARTICIPANTS_UPDATE", sessionService.getStudents(sessionCode));
            broadcastToHost(sessionCode, "SESSION_CAPACITY_UPDATE", buildCapacityPayload(sessionCode));
        } catch (IOException ignored) {
            // Host may disconnect during cleanup broadcast.
        }
    }

    private void sendPeerDisconnectedToHost(String sessionCode, String participantId) throws IOException {
        LiveSessionService.Participant host = sessionService.getHostParticipant(sessionCode);
        if (host == null || host.getSession() == null || !host.getSession().isOpen()) {
            return;
        }

        SignalingMessage message = new SignalingMessage();
        message.setType("PEER_DISCONNECTED");
        message.setParticipantId(participantId);
        message.setSessionCode(sessionCode);

        host.getSession().sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
    }

    private void broadcastToHost(String sessionCode, String type, Object payload) throws IOException {
        LiveSessionService.Participant host = sessionService.getHostParticipant(sessionCode);
        if (host != null && host.getSession() != null && host.getSession().isOpen()) {
            host.getSession()
                    .sendMessage(new TextMessage(objectMapper.writeValueAsString(buildMessage(type, null, payload))));
        }
    }

    private void broadcastToAdmittedStudents(String sessionCode, String type, Object payload) throws IOException {
        for (LiveSessionService.Participant participant : sessionService.getStudents(sessionCode)) {
            if (!"ADMITTED".equals(participant.getStatus())) {
                continue;
            }
            if (participant.getSession() == null || !participant.getSession().isOpen()) {
                continue;
            }
            participant.getSession()
                    .sendMessage(new TextMessage(objectMapper.writeValueAsString(buildMessage(type, null, payload))));
        }
    }

    private boolean sendToTarget(String sessionCode, String targetId, Object sm) throws IOException {
        WebSocketSession targetSession = sessionService.getTargetSession(sessionCode, targetId);
        if (targetSession != null && targetSession.isOpen()) {
            targetSession.sendMessage(new TextMessage(objectMapper.writeValueAsString(sm)));
            return true;
        }
        return false;
    }

    private void sendToSession(WebSocketSession session, SignalingMessage sm) throws IOException {
        if (session.isOpen()) {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(sm)));
        }
    }

    private SignalingMessage buildMessage(String type, String targetId, Object payload) {
        SignalingMessage sm = new SignalingMessage();
        sm.setType(type);
        sm.setTargetId(targetId);
        sm.setPayload(payload);
        return sm;
    }

    @SuppressWarnings("unchecked")
    private boolean getBoolean(Object payload, String key) {
        if (!(payload instanceof java.util.Map<?, ?> payloadMap)) {
            return false;
        }
        Object value = ((java.util.Map<String, Object>) payloadMap).get(key);
        return value instanceof Boolean b && b;
    }

    @SuppressWarnings("unchecked")
    private Integer parseCapacity(Object payload) {
        if (!(payload instanceof java.util.Map<?, ?> payloadMap)) {
            return null;
        }
        Object value = ((java.util.Map<String, Object>) payloadMap).get("capacity");
        if (value instanceof Number numberValue) {
            return numberValue.intValue();
        }
        if (value instanceof String strValue) {
            try {
                return Integer.parseInt(strValue.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    private SignalingMessage buildMediaToggleMessage(SignalingMessage incoming, String senderId) {
        SignalingMessage outbound = new SignalingMessage();
        outbound.setType("MEDIA_TOGGLE");
        outbound.setSessionCode(incoming.getSessionCode());
        outbound.setParticipantId(senderId);
        outbound.setTargetId(incoming.getTargetId());
        outbound.setPayload(Map.of(
                "video", getBooleanWithFallback(incoming.getPayload(), "video", "videoEnabled"),
                "audio", getBooleanWithFallback(incoming.getPayload(), "audio", "audioEnabled"),
                "screen", getBooleanWithFallback(incoming.getPayload(), "screen", "screenEnabled")));
        return outbound;
    }

    @SuppressWarnings("unchecked")
    private boolean getBooleanWithFallback(Object payload, String key, String fallbackKey) {
        if (!(payload instanceof java.util.Map<?, ?> payloadMap)) {
            return false;
        }
        Map<String, Object> values = (Map<String, Object>) payloadMap;
        Object value = values.containsKey(key) ? values.get(key) : values.get(fallbackKey);
        return value instanceof Boolean b && b;
    }

    private java.util.Map<String, Object> buildCapacityPayload(String sessionCode) {
        return java.util.Map.of(
                "capacity", sessionService.getSessionCapacity(sessionCode),
                "admittedCount", sessionService.countAdmittedStudents(sessionCode));
    }

    private String firstNonBlank(String first, String second) {
        if (first != null && !first.isBlank()) {
            return first;
        }
        return second;
    }
}
