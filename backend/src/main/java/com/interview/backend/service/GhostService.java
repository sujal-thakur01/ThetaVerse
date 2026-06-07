package com.interview.backend.service;

import com.interview.backend.entity.GhostPerformance;
import com.interview.backend.entity.Roadmap;
import com.interview.backend.repository.GhostPerformanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class GhostService {

    private final GhostPerformanceRepository ghostPerformanceRepository;

    /**
     * Initializes the ghost for a new TargetProfile with a fixed velocity
     */
    @Transactional
    public GhostPerformance initializeGhost(Roadmap roadmap, Double initialVelocity) {
        GhostPerformance ghost = GhostPerformance.builder()
                .roadmap(roadmap)
                .lastSyncedTopicIndex(0)
                .initialFixedVelocity(initialVelocity)
                .build();
        return ghostPerformanceRepository.save(ghost);
    }

    /**
     * Updates the Ghost's benchmark position based on time passed and current
     * velocity.
     * Can be called daily via a Cron job or upon user request.
     */
    @Transactional
    public void syncGhostPosition(Long ghostPerformanceId) {
        GhostPerformance ghost = ghostPerformanceRepository.findById(ghostPerformanceId)
                .orElseThrow(() -> new RuntimeException("Ghost not found"));

        // Simplistic logic: advance the ghost by its velocity
        int newIndex = ghost.getLastSyncedTopicIndex() + (int) Math.round(ghost.getInitialFixedVelocity());
        ghost.setLastSyncedTopicIndex(newIndex);

        ghostPerformanceRepository.save(ghost);
    }

    /**
     * Optionally adjust the Ghost's velocity if the user is falling too far behind.
     * Maps to: "Dynamic: Adjusts the ghost's pace if the user slows down."
     */
    @Transactional
    public void adjustGhostVelocity(Long ghostPerformanceId, Double userCurrentPace) {
        GhostPerformance ghost = ghostPerformanceRepository.findById(ghostPerformanceId)
                .orElseThrow(() -> new RuntimeException("Ghost not found"));

        // If the user's pace drops significantly below the ghost's velocity, slow the
        // ghost down slightly
        if (userCurrentPace < ghost.getInitialFixedVelocity() * 0.5) {
            double adjustedVelocity = ghost.getInitialFixedVelocity() * 0.8;
            ghost.setInitialFixedVelocity(Math.max(adjustedVelocity, 1.0)); // Don't let it drop below 1
            ghostPerformanceRepository.save(ghost);
        }
    }

    @Transactional(readOnly = true)
    public java.util.Map<String, Object> getGhostPace(Long roadmapId) {
        GhostPerformance ghost = ghostPerformanceRepository.findAll().stream()
                .filter(g -> g.getRoadmap().getId().equals(roadmapId))
                .findFirst()
                .orElse(null);

        if (ghost == null || ghost.getRoadmap() == null) {
            return java.util.Map.of("error", "Ghost performance not found for this roadmap");
        }

        Roadmap rm = ghost.getRoadmap();
        long daysPassed = java.time.temporal.ChronoUnit.DAYS.between(rm.getStartDate(), java.time.LocalDate.now());
        if (daysPassed < 1)
            daysPassed = 1; // Default to 1 to avoid zero-multiplication on day 1.

        // True Math: How many topics *should* the Ghost have completed by now?
        double expectedGhostScore = daysPassed * ghost.getInitialFixedVelocity();

        // Check how many topics the user *actually* completed.
        long userCompletedTopics = rm.getTopics().stream()
                .filter(com.interview.backend.entity.RoadmapTopic::getIsCompleted).count();

        // Ghost index is fundamentally capped by the length of the topics array
        long maxTopics = rm.getTopics().size();
        if (expectedGhostScore > maxTopics)
            expectedGhostScore = maxTopics;

        return java.util.Map.of(
                "ghostPace", ghost.getInitialFixedVelocity(),
                "ghostScore", expectedGhostScore,
                "userScore", userCompletedTopics,
                "isBehind", userCompletedTopics < expectedGhostScore);
    }
}
