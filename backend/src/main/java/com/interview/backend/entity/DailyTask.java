package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDate;

@Entity
@Table(name = "daily_tasks")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DailyTask {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "roadmap_topic_id")
    private RoadmapTopic roadmapTopic;

    private LocalDate targetDate;
    private String status; // Pending, Completed
}
