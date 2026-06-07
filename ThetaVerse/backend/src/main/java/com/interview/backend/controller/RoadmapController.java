package com.interview.backend.controller;

import com.interview.backend.entity.DailyTask;
import com.interview.backend.entity.Roadmap;
import com.interview.backend.service.DailyTaskService;
import com.interview.backend.service.RoadmapService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/roadmaps")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class RoadmapController {

    private final RoadmapService roadmapService;
    private final DailyTaskService dailyTaskService;

    @PostMapping("/generate")
    public ResponseEntity<Roadmap> generateRoadmap(@RequestBody GenerateRoadmapRequest request) {
        Roadmap roadmap = roadmapService.generateRoadmap(request);
        return ResponseEntity.ok(roadmap);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Roadmap> getRoadmap(@PathVariable Long id) {
        return ResponseEntity.ok(roadmapService.getRoadmap(id));
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<Roadmap>> getRoadmapsByUser(@PathVariable Long userId) {
        return ResponseEntity.ok(roadmapService.getRoadmapsByUser(userId));
    }

    @PutMapping("/topics/{topicId}/complete")
    public ResponseEntity<?> markTopicComplete(@PathVariable Long topicId) {
        return ResponseEntity.ok(roadmapService.markTopicComplete(topicId));
    }

    @PutMapping("/topics/{topicId}/subtopics/complete")
    public ResponseEntity<?> markSubtopicComplete(
            @PathVariable Long topicId, 
            @RequestParam String subtopicTitle) {
        return ResponseEntity.ok(roadmapService.markSubtopicComplete(topicId, subtopicTitle));
    }

    @PostMapping("/{roadmapId}/schedule")
    public ResponseEntity<List<DailyTask>> scheduleRoadmapTasks(@PathVariable Long roadmapId) {
        List<DailyTask> tasks = dailyTaskService.scheduleTasks(roadmapId);
        return ResponseEntity.ok(tasks);
    }
}
