package com.interview.backend.service;

import com.interview.backend.entity.*;
import com.interview.backend.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DailyTaskService {

    private final DailyTaskRepository dailyTaskRepository;
    private final RoadmapRepository roadmapRepository;

    /**
     * Distributes Roadmap topics evenly over the days between now and the target date.
     */
    @Transactional
    public List<DailyTask> scheduleTasks(Long roadmapId) {
        Roadmap roadmap = roadmapRepository.findById(roadmapId)
                .orElseThrow(() -> new RuntimeException("Roadmap not found"));

        TargetProfile profile = roadmap.getTargetProfile();
        LocalDate startDate = LocalDate.now();
        LocalDate endDate = profile.getTargetDate();

        if (endDate == null || endDate.isBefore(startDate)) {
            // Default to 30 days if no valid date is set
            endDate = startDate.plusDays(30);
        }

        long daysAvailable = ChronoUnit.DAYS.between(startDate, endDate);
        if (daysAvailable == 0) daysAvailable = 1;

        List<RoadmapTopic> topics = roadmap.getTopics();
        int topicsPerDay = (int) Math.ceil((double) topics.size() / daysAvailable);

        List<DailyTask> scheduledTasks = new ArrayList<>();
        int currentDayOffset = 0;

        for (int i = 0; i < topics.size(); i++) {
            if (i > 0 && i % topicsPerDay == 0) {
                currentDayOffset++;
            }

            LocalDate taskDate = startDate.plusDays(Math.min(currentDayOffset, daysAvailable - 1));

            DailyTask task = DailyTask.builder()
                    .user(profile.getUser())
                    .roadmapTopic(topics.get(i))
                    .targetDate(taskDate)
                    .status("Pending")
                    .build();

            scheduledTasks.add(task);
        }

        return dailyTaskRepository.saveAll(scheduledTasks);
    }
}
