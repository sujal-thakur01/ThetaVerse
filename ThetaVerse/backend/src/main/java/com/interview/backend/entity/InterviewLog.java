package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "interview_logs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interview_session_id")
    private InterviewSession session;

    private String role; // e.g., "user", "ai", "system"
    @Column(columnDefinition = "TEXT")
    private String content;
    private LocalDateTime timestamp;
}
