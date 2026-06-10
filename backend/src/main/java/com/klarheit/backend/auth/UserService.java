package com.klarheit.backend.auth;

import java.util.Optional;

public interface UserService {
    Optional<UserAccount> findByEmailIgnoreCase(String email);
    Optional<UserAccount> findById(Long id);
}
