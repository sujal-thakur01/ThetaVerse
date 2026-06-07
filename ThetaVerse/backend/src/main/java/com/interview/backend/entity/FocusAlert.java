package com.interview.backend.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "focus_alerts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FocusAlert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "focus_session_id")
    private FocusSession focusSession;

    private String alertType; // e.g., Posture, Gaze, Phone
    private LocalDateTime timestamp;
}
