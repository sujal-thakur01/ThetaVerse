package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "ghost_performances")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class GhostPerformance {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "roadmap_id")
    private Roadmap roadmap;

    private Integer lastSyncedTopicIndex;
    private Double initialFixedVelocity; // Topics per day or hours per day
}
