package com.interview.backend.repository;

import com.interview.backend.entity.FocusAlert;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface FocusAlertRepository extends JpaRepository<FocusAlert, Long> {
}
