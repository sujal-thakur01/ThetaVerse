package com.interview.backend.repository;

import com.interview.backend.entity.TargetProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface TargetProfileRepository extends JpaRepository<TargetProfile, Long> {
}
