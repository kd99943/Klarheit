package com.klarheit.backend.security;

import java.util.Set;

/**
 * Staff role hierarchy for least-privilege backend access control (P0-10).
 */
public final class StaffRoles {
    private StaffRoles() {}

    public static final String USER = "USER";
    public static final String ADMIN = "ADMIN";
    public static final String CUSTOMER_SERVICE = "CUSTOMER_SERVICE";
    public static final String OPTICIAN = "OPTICIAN";
    public static final String WAREHOUSE = "WAREHOUSE";
    public static final String FINANCE = "FINANCE";

    public static final Set<String> ALL_STAFF_ROLES = Set.of(
            ADMIN, CUSTOMER_SERVICE, OPTICIAN, WAREHOUSE, FINANCE
    );

    public static final Set<String> ALL_VALID_ROLES = Set.of(
            USER, ADMIN, CUSTOMER_SERVICE, OPTICIAN, WAREHOUSE, FINANCE
    );

    public static boolean isStaffRole(String role) {
        return role != null && ALL_STAFF_ROLES.contains(role.trim().toUpperCase());
    }

    public static boolean isValidRole(String role) {
        return role != null && ALL_VALID_ROLES.contains(role.trim().toUpperCase());
    }
}
