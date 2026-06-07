package com.interview.backend.service;

import com.interview.backend.entity.*;
import com.interview.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class FocusAnalyticsService {

    private final FocusSessionRepository focusSessionRepository;
    private final FocusAlertRepository alertRepository;
    private final InterviewSessionRepository interviewSessionRepository;

    @Transactional
    public FocusSession startFocusTracking(Long interviewSessionId) {
        InterviewSession interviewSession = interviewSessionRepository.findById(interviewSessionId)
                .orElseThrow(() -> new RuntimeException("Session not found"));

        FocusSession focusSession = FocusSession.builder()
                .interviewSession(interviewSession)
                .totalDurationSeconds(0L)
                .distractionDurationSeconds(0L)
                .build();

        return focusSessionRepository.save(focusSession);
    }

    @Transactional
    public FocusAlert recordDistraction(Long focusSessionId, String type) {
        FocusSession focusSession = focusSessionRepository.findById(focusSessionId)
                .orElseThrow(() -> new RuntimeException("Focus Session not found"));

        FocusAlert alert = FocusAlert.builder()
                .focusSession(focusSession)
                .alertType(type) // "Gaze", "Posture", "Phone"
                .timestamp(LocalDateTime.now())
                .build();

        // Increment assumed distraction duration (e.g. 5 seconds per alert)
        focusSession.setDistractionDurationSeconds(focusSession.getDistractionDurationSeconds() + 5);
        focusSessionRepository.save(focusSession);

        return alertRepository.save(alert);
    }
    
    @Transactional
    public Double calculateFinalFocusScore(Long focusSessionId) {
        FocusSession session = focusSessionRepository.findById(focusSessionId)
                .orElseThrow(() -> new RuntimeException("Focus Session not found"));
                
        if (session.getTotalDurationSeconds() == null || session.getTotalDurationSeconds() <= 0) {
            return 100.0;
        }

        double distractionRatio = (double) session.getDistractionDurationSeconds() / session.getTotalDurationSeconds();
        double score = 100.0 - (distractionRatio * 100.0);
        return Math.max(0.0, score);
    }
}
