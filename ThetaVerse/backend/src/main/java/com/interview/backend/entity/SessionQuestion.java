package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "session_questions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SessionQuestion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interview_session_id")
    private InterviewSession session;

    private String topic;

    @Column(columnDefinition = "TEXT")
    private String questionText;

    @Column(columnDefinition = "TEXT")
    private String userAnswer;

    @Column(columnDefinition = "TEXT")
    private String aiResponse;
}
