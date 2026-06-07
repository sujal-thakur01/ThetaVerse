package com.interview.backend.controller;

import com.interview.backend.entity.FocusAlert;
import com.interview.backend.entity.FocusSession;
import com.interview.backend.service.FocusAnalyticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/focus")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class FocusController {

    private final FocusAnalyticsService focusService;

    @PostMapping("/start/{interviewSessionId}")
    public ResponseEntity<FocusSession> startFocusTracking(@PathVariable Long interviewSessionId) {
        FocusSession session = focusService.startFocusTracking(interviewSessionId);
        return ResponseEntity.ok(session);
    }

    @PostMapping("/{focusSessionId}/alert")
    public ResponseEntity<FocusAlert> recordDistraction(
            @PathVariable Long focusSessionId,
            @RequestParam String type) {
        
        FocusAlert alert = focusService.recordDistraction(focusSessionId, type);
        return ResponseEntity.ok(alert);
    }

    @GetMapping("/{focusSessionId}/score")
    public ResponseEntity<Double> getFinalScore(@PathVariable Long focusSessionId) {
        Double score = focusService.calculateFinalFocusScore(focusSessionId);
        return ResponseEntity.ok(score);
    }
}
