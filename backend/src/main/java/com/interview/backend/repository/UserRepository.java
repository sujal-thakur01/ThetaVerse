package com.interview.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.interview.backend.entity.Role;
import com.interview.backend.entity.User;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findFirstByEmailOrderByIdDesc(String email);
    List<User> findByRoleOrderByNameAsc(Role role);
}
