package com.interview.backend.controller;

import com.interview.backend.service.LiveSessionService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/live-sessions")
@CrossOrigin(origins = "*")
public class LiveSessionController {

    private final LiveSessionService sessionService;

    public LiveSessionController(LiveSessionService sessionService) {
        this.sessionService = sessionService;
    }

    @PostMapping("/create")
    public ResponseEntity<?> createSession(@RequestBody Map<String, String> request) {
        String hostName = request.getOrDefault("hostName", "Interviewer");
        String code = sessionService.createSession(hostName);
        LiveSessionService.Participant host = sessionService.getHostParticipant(code);

        return ResponseEntity.ok(Map.of(
                "sessionCode", code,
                "hostId", host.getId()));
    }

    @GetMapping("/validate/{code}")
    public ResponseEntity<?> validateSession(@PathVariable String code) {
        if (sessionService.getSession(code) != null) {
            return ResponseEntity.ok(Map.of("valid", true));
        }
        return ResponseEntity.status(404).body(Map.of("valid", false, "error", "Session not found"));
    }

    @GetMapping("/{code}/debug")
    public ResponseEntity<?> debugSession(@PathVariable String code) {
        Map<String, Object> snapshot = sessionService.getSessionDebugSnapshot(code);
        if (snapshot == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Session not found"));
        }
        return ResponseEntity.ok(snapshot);
    }
}
