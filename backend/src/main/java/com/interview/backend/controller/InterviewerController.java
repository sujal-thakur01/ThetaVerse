package com.interview.backend.controller;

import java.security.Principal;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.interview.backend.dto.CreateAvailabilitySlotRequest;
import com.interview.backend.dto.CreateInterviewerProfileRequest;
import com.interview.backend.dto.InterviewAvailabilitySlotResponse;
import com.interview.backend.dto.InterviewerProfileResponse;
import com.interview.backend.entity.Role;
import com.interview.backend.entity.User;
import com.interview.backend.repository.UserRepository;
import com.interview.backend.service.InterviewSimulationService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/interviewers")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class InterviewerController {

    private final InterviewSimulationService interviewService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<InterviewerProfileResponse>> getInterviewers() {
        return ResponseEntity.ok(interviewService.getInterviewerProfiles());
    }

    @GetMapping("/{interviewerId}/slots")
    public ResponseEntity<List<InterviewAvailabilitySlotResponse>> getInterviewerSlots(
            @PathVariable Long interviewerId,
            @RequestParam(defaultValue = "true") boolean onlyAvailable) {

        if (onlyAvailable) {
            return ResponseEntity.ok(interviewService.getAvailableSlots(interviewerId));
        }
        return ResponseEntity.ok(interviewService.getInterviewerSlots(interviewerId));
    }

    @GetMapping("/profile/me")
    public ResponseEntity<InterviewerProfileResponse> getMyProfile(Principal principal) {
        User user = getCurrentUser(principal);
        ensureInterviewer(user);
        return ResponseEntity.ok(interviewService.getInterviewerProfile(user.getId()));
    }

    @PostMapping("/profile")
    public ResponseEntity<InterviewerProfileResponse> upsertMyProfile(
            Principal principal,
            @RequestBody CreateInterviewerProfileRequest request) {
        User user = getCurrentUser(principal);
        ensureInterviewer(user);
        return ResponseEntity.ok(interviewService.upsertInterviewerProfile(user.getId(), request));
    }

    @PostMapping("/slots")
    public ResponseEntity<InterviewAvailabilitySlotResponse> createSlot(
            Principal principal,
            @RequestBody CreateAvailabilitySlotRequest request) {
        User user = getCurrentUser(principal);
        ensureInterviewer(user);
        return ResponseEntity.ok(interviewService.createAvailabilitySlot(user.getId(), request));
    }

    @GetMapping("/slots/me")
    public ResponseEntity<List<InterviewAvailabilitySlotResponse>> getMySlots(Principal principal) {
        User user = getCurrentUser(principal);
        ensureInterviewer(user);
        return ResponseEntity.ok(interviewService.getInterviewerSlots(user.getId()));
    }

    private User getCurrentUser(Principal principal) {
        return userRepository.findFirstByEmailOrderByIdDesc(principal.getName())
                .orElseThrow(() -> new RuntimeException("User not found"));
    }

    private void ensureInterviewer(User user) {
        if (user.getRole() != Role.INTERVIEWER) {
            throw new RuntimeException("Only interviewer accounts can access this endpoint");
        }
    }
}
