package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "roadmap_topics")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RoadmapTopic {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ToString.Exclude
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "roadmap_id")
    private Roadmap roadmap;

    private String title;
    private String priority; // High, Med, Low
    private Double estimatedHours;
    private Boolean isCompleted;
    private Integer sequenceOrder; // To track order for Ghost mode

    @Column(columnDefinition = "TEXT")
    private String referenceLinks;

    @ElementCollection
    @CollectionTable(name = "roadmap_topic_subtopics", joinColumns = @JoinColumn(name = "topic_id"))
    private java.util.List<Subtopic> subtopics;
}
