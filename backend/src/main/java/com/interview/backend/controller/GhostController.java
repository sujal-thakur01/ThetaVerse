package com.interview.backend.controller;

import com.interview.backend.service.GhostService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@RequestMapping("/api/ghosts")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class GhostController {

    private final GhostService ghostService;
   
    @GetMapping("/roadmap/{roadmapId}")
    public ResponseEntity<Map<String, Object>> getGhostPace(@PathVariable Long roadmapId) {
        return ResponseEntity.ok(ghostService.getGhostPace(roadmapId));
    }
}
