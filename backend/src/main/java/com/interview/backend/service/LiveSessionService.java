package com.interview.backend.service;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.WebSocketSession;

import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
@Slf4j
public class LiveSessionService {

    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final int CODE_LENGTH = 10;
    private static final int MAX_ALLOWED_CAPACITY = 5;
    private final SecureRandom secureRandom = new SecureRandom();

    @Data
    public static class Participant {
        private String id;
        private String name;
        private String role; // "HOST" or "STUDENT"
        private String status; // "WAITING" or "ADMITTED"
        @JsonIgnore
        private transient WebSocketSession session; // don't serialize this!
        @JsonIgnore
        private transient String sessionCode;
    }

    @Data
    public static class LiveSession {
        private String sessionCode;
        private Participant host;
        private Map<String, Participant> students = new ConcurrentHashMap<>();
        private int maxAdmittedStudents = 1;
        private boolean hostVideoEnabled = false;
        private boolean hostAudioEnabled = false;
        private boolean hostScreenEnabled = false;
    }

    private final Map<String, LiveSession> activeSessions = new ConcurrentHashMap<>();

    // Quick lookup maps to handle WebSocket disconnects natively
    private final Map<String, String> socketToParticipantId = new ConcurrentHashMap<>();
    private final Map<String, String> socketToSessionCode = new ConcurrentHashMap<>();

    public String createSession(String hostName) {
        String code = generateUniqueSessionCode();
        LiveSession session = new LiveSession();
        session.setSessionCode(code);
        Participant host = new Participant();
        host.setId("HOST-" + UUID.randomUUID().toString());
        host.setName(hostName);
        host.setRole("HOST");
        host.setStatus("ADMITTED");
        host.setSessionCode(code);
        session.setHost(host);

        activeSessions.put(code, session);
        return code;
    }

    public LiveSession getSession(String code) {
        return activeSessions.get(code);
    }

    public Participant getHostParticipant(String code) {
        LiveSession s = activeSessions.get(code);
        return s != null ? s.getHost() : null;
    }

    public Map<String, Object> getSessionDebugSnapshot(String sessionCode) {
        LiveSession session = activeSessions.get(sessionCode);
        if (session == null) {
            return null;
        }

        List<Map<String, Object>> students = new ArrayList<>();
        for (Participant student : session.getStudents().values()) {
            students.add(Map.of(
                    "id", student.getId(),
                    "name", student.getName(),
                    "status", student.getStatus(),
                    "connected", student.getSession() != null && student.getSession().isOpen()));
        }

        return Map.of(
                "sessionCode", sessionCode,
                "capacity", session.getMaxAdmittedStudents(),
                "admittedCount", countAdmittedStudents(sessionCode),
                "host", Map.of(
                        "id", session.getHost().getId(),
                        "name", session.getHost().getName(),
                        "connected", session.getHost().getSession() != null && session.getHost().getSession().isOpen()),
                "students", students);
    }

    public Participant addStudent(String sessionCode, String name, WebSocketSession wsSession) {
        LiveSession session = activeSessions.get(sessionCode);
        if (session == null)
            return null;

        Participant student = new Participant();
        student.setId("STUDENT-" + UUID.randomUUID().toString());
        student.setName(name);
        student.setRole("STUDENT");
        student.setStatus("WAITING");
        student.setSession(wsSession);
        student.setSessionCode(sessionCode);

        session.getStudents().put(student.getId(), student);

        if (wsSession != null) {
            socketToParticipantId.put(wsSession.getId(), student.getId());
            socketToSessionCode.put(wsSession.getId(), sessionCode);
        }

        return student;
    }

    public void registerHostWebSocket(String sessionCode, String hostId, WebSocketSession wsSession) {
        LiveSession session = activeSessions.get(sessionCode);
        if (session == null) {
            log.warn("registerHostWebSocket: session not found for code={}", sessionCode);
            return;
        }

        String expectedHostId = session.getHost().getId();
        if (!expectedHostId.equals(hostId)) {
            log.warn(
                    "registerHostWebSocket: hostId mismatch for code={}, expectedHostId={}, receivedHostId={}",
                    sessionCode,
                    expectedHostId,
                    hostId);
            return;
        }

        WebSocketSession existingSession = session.getHost().getSession();
        if (existingSession != null && !existingSession.getId().equals(wsSession.getId())) {
            socketToParticipantId.remove(existingSession.getId());
            socketToSessionCode.remove(existingSession.getId());
        }

        session.getHost().setSession(wsSession);
        if (wsSession != null) {
            socketToParticipantId.put(wsSession.getId(), hostId);
            socketToSessionCode.put(wsSession.getId(), sessionCode);
            log.info("registerHostWebSocket: host connected for code={}, hostId={}, wsId={}", sessionCode, hostId,
                    wsSession.getId());
        } else {
            log.warn("registerHostWebSocket: wsSession is null for code={}, hostId={}", sessionCode, hostId);
        }
    }

    public boolean admitStudent(String sessionCode, String studentId) {
        LiveSession session = activeSessions.get(sessionCode);
        if (session != null) {
            Participant p = session.getStudents().get(studentId);
            if (p != null && (session.getStudents().values().stream().filter(s -> "ADMITTED".equals(s.getStatus()))
                    .count() < session.getMaxAdmittedStudents())) {
                p.setStatus("ADMITTED");
                return true;
            }
        }
        return false;
    }

    public void setSessionCapacity(String sessionCode, int requestedCapacity) {
        LiveSession session = activeSessions.get(sessionCode);
        if (session == null) {
            return;
        }

        int sanitized = Math.max(1, Math.min(requestedCapacity, MAX_ALLOWED_CAPACITY));
        session.setMaxAdmittedStudents(sanitized);
    }

    public int getSessionCapacity(String sessionCode) {
        LiveSession session = activeSessions.get(sessionCode);
        return session != null ? session.getMaxAdmittedStudents() : 1;
    }

    public int countAdmittedStudents(String sessionCode) {
        LiveSession session = activeSessions.get(sessionCode);
        if (session == null) {
            return 0;
        }
        return (int) session.getStudents().values().stream().filter(s -> "ADMITTED".equals(s.getStatus())).count();
    }

    public void updateHostMediaPermissions(String sessionCode, boolean videoEnabled, boolean audioEnabled,
            boolean screenEnabled) {
        LiveSession session = activeSessions.get(sessionCode);
        if (session == null) {
            return;
        }
        session.setHostVideoEnabled(videoEnabled);
        session.setHostAudioEnabled(audioEnabled);
        session.setHostScreenEnabled(screenEnabled);
    }

    public Map<String, Object> getHostMediaPermissions(String sessionCode) {
        LiveSession session = activeSessions.get(sessionCode);
        if (session == null) {
            return Map.of(
                    "videoEnabled", false,
                    "audioEnabled", false,
                    "screenEnabled", false);
        }

        return Map.of(
                "videoEnabled", session.isHostVideoEnabled(),
                "audioEnabled", session.isHostAudioEnabled(),
                "screenEnabled", session.isHostScreenEnabled());
    }

    public void rejectStudent(String sessionCode, String studentId) {
        LiveSession session = activeSessions.get(sessionCode);
        if (session != null) {
            session.getStudents().remove(studentId);
        }
    }

    public Participant removeStudent(String sessionCode, String studentId) {
        LiveSession session = activeSessions.get(sessionCode);
        if (session == null || studentId == null) {
            return null;
        }

        Participant removed = session.getStudents().remove(studentId);
        if (removed == null) {
            return null;
        }

        WebSocketSession wsSession = removed.getSession();
        if (wsSession != null) {
            socketToParticipantId.remove(wsSession.getId());
            socketToSessionCode.remove(wsSession.getId());
        }
        return removed;
    }

    public List<Participant> getStudents(String sessionCode) {
        LiveSession session = activeSessions.get(sessionCode);
        if (session == null)
            return Collections.emptyList();
        return new ArrayList<>(session.getStudents().values());
    }

    public WebSocketSession getTargetSession(String sessionCode, String targetId) {
        LiveSession session = activeSessions.get(sessionCode);
        if (session == null)
            return null;
        if (session.getHost().getId().equals(targetId)) {
            return session.getHost().getSession();
        }
        Participant student = session.getStudents().get(targetId);
        return student != null ? student.getSession() : null;
    }

    public boolean isHost(String sessionCode, String participantId) {
        LiveSession session = activeSessions.get(sessionCode);
        return session != null && session.getHost().getId().equals(participantId);
    }

    public boolean isAdmittedStudent(String sessionCode, String participantId) {
        LiveSession session = activeSessions.get(sessionCode);
        if (session == null) {
            return false;
        }
        Participant participant = session.getStudents().get(participantId);
        return participant != null && "ADMITTED".equals(participant.getStatus());
    }

    public boolean canSignalBetween(String sessionCode, String senderId, String targetId) {
        if (senderId == null || targetId == null || senderId.equals(targetId)) {
            return false;
        }

        boolean senderHost = isHost(sessionCode, senderId);
        boolean targetHost = isHost(sessionCode, targetId);
        boolean senderAdmitted = isAdmittedStudent(sessionCode, senderId);
        boolean targetAdmitted = isAdmittedStudent(sessionCode, targetId);

        // Enforce host <-> admitted-student signaling only.
        return (senderHost && targetAdmitted) || (targetHost && senderAdmitted);
    }

    public Participant handleDisconnect(String wsSessionId) {
        String participantId = socketToParticipantId.get(wsSessionId);
        String sessionCode = socketToSessionCode.get(wsSessionId);
        if (participantId == null || sessionCode == null)
            return null;

        LiveSession session = activeSessions.get(sessionCode);
        if (session == null) {
            socketToParticipantId.remove(wsSessionId);
            socketToSessionCode.remove(wsSessionId);
            return null;
        }

        Participant participant = resolveParticipant(session, participantId);
        if (participant == null) {
            socketToParticipantId.remove(wsSessionId);
            socketToSessionCode.remove(wsSessionId);
            return null;
        }

        WebSocketSession currentSession = participant.getSession();
        if (currentSession != null && !wsSessionId.equals(currentSession.getId())) {
            // Ignore stale close events from old sockets so active participants stay
            // connected.
            log.info(
                    "handleDisconnect: stale close ignored for participantId={}, sessionCode={}, closedWsId={}, currentWsId={}",
                    participantId,
                    sessionCode,
                    wsSessionId,
                    currentSession.getId());
            socketToParticipantId.remove(wsSessionId);
            socketToSessionCode.remove(wsSessionId);
            return null;
        }

        socketToParticipantId.remove(wsSessionId);
        socketToSessionCode.remove(wsSessionId);

        if (session.getHost().getId().equals(participantId)) {
            session.getHost().setSession(null);
            return session.getHost();
        }

        Participant student = session.getStudents().get(participantId);
        if (student != null) {
            student.setSession(null);
            student.setSessionCode(sessionCode);
        }
        return student;
    }

    public boolean removeStudentIfStillDisconnected(String sessionCode, String participantId) {
        LiveSession session = activeSessions.get(sessionCode);
        if (session == null || participantId == null) {
            return false;
        }

        Participant participant = session.getStudents().get(participantId);
        if (participant == null) {
            return false;
        }

        WebSocketSession currentSession = participant.getSession();
        if (currentSession != null && currentSession.isOpen()) {
            return false;
        }

        return session.getStudents().remove(participantId) != null;
    }

    private Participant resolveParticipant(LiveSession session, String participantId) {
        if (session.getHost().getId().equals(participantId)) {
            return session.getHost();
        }
        return session.getStudents().get(participantId);
    }

    private String generateUniqueSessionCode() {
        String code;
        do {
            code = generateCodeCandidate();
        } while (activeSessions.containsKey(code));
        return code;
    }

    private String generateCodeCandidate() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            int idx = secureRandom.nextInt(CODE_CHARS.length());
            sb.append(CODE_CHARS.charAt(idx));
        }
        return sb.toString();
    }
}
