package com.interview.backend.entity;

import java.time.LocalDateTime;

import com.fasterxml.jackson.annotation.JsonIgnore;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "interview_sessions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InterviewSession {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    private User user;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_profile_id")
    private TargetProfile targetProfile;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "interviewer_user_id")
    private User interviewerUser;

    @OneToOne(fetch = FetchType.LAZY, cascade = CascadeType.ALL)
    @JoinColumn(name = "interviewer_persona_id")
    private InterviewerPersona interviewerPersona;

    @Column(columnDefinition = "TEXT")
    private String roundTypes; // Added to store round types

    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL)
    private java.util.List<InterviewLog> logs;

    @OneToOne(mappedBy = "interviewSession", cascade = CascadeType.ALL)
    private FocusSession focusSession;

    private LocalDateTime startTime;
    private LocalDateTime endTime;

    private Double techScore;
    private Double focusScore;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private InterviewMode mode;

    private LocalDateTime scheduledAt;
    private Integer durationMinutes;

    @Column(columnDefinition = "TEXT")
    private String externalMeetingLink;

    @Column(columnDefinition = "TEXT")
    private String resumeText;
}
