package com.klarheit.backend.config;

import java.util.List;

public record ApiErrorResponse(String error, String message, List<String> details) {}
