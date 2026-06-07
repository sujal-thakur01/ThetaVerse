package com.interview.backend.controller;

import com.interview.backend.entity.TargetProfile;
import com.interview.backend.entity.User;
import com.interview.backend.repository.TargetProfileRepository;
import com.interview.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/profiles")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // Allows React frontend to hit the API
public class ProfileController {

    private final UserRepository userRepository;
    private final TargetProfileRepository targetProfileRepository;

    @PostMapping("/user")
    public ResponseEntity<User> createUser(@RequestBody User user) {
        return ResponseEntity.ok(userRepository.save(user));
    }

    @PostMapping("/target")
    public ResponseEntity<TargetProfile> createTargetProfile(@RequestBody TargetProfile profile) {
        return ResponseEntity.ok(targetProfileRepository.save(profile));
    }

    @GetMapping("/user/{userId}/targets")
    public ResponseEntity<List<TargetProfile>> getUserTargetProfiles(@PathVariable Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return ResponseEntity.ok(user.getTargetProfiles());
    }
}
