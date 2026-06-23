package com.klarheit.backend.sms;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Component;

@Component
public class VerificationCodeStore {
    private static final long TTL_MILLIS = 5 * 60 * 1000; // 5 minutes
    private static final long COOLDOWN_MILLIS = 60 * 1000; // 60 seconds
    private static final int MAX_ATTEMPTS = 5;

    private final ConcurrentHashMap<String, CodeEntry> store = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> lastSendTime = new ConcurrentHashMap<>();

    public record CodeEntry(String code, long createdAt, int attempts) {}

    public VerificationCodeStore() {
        ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "sms-code-cleanup");
            t.setDaemon(true);
            return t;
        });
        scheduler.scheduleAtFixedRate(this::cleanup, 1, 1, TimeUnit.MINUTES);
    }

    public void put(String phone, String code) {
        store.put(phone, new CodeEntry(code, System.currentTimeMillis(), 0));
        lastSendTime.put(phone, System.currentTimeMillis());
    }

    public CodeEntry get(String phone) {
        return store.get(phone);
    }

    public void incrementAttempts(String phone) {
        CodeEntry entry = store.get(phone);
        if (entry != null) {
            store.put(phone, new CodeEntry(entry.code(), entry.createdAt(), entry.attempts() + 1));
        }
    }

    public void remove(String phone) {
        store.remove(phone);
    }

    public boolean isOnCooldown(String phone) {
        Long lastSend = lastSendTime.get(phone);
        return lastSend != null && (System.currentTimeMillis() - lastSend) < COOLDOWN_MILLIS;
    }

    public long getCooldownRemainingSeconds(String phone) {
        Long lastSend = lastSendTime.get(phone);
        if (lastSend == null) return 0;
        long elapsed = System.currentTimeMillis() - lastSend;
        return Math.max(0, (COOLDOWN_MILLIS - elapsed) / 1000);
    }

    public boolean isExpired(CodeEntry entry) {
        return (System.currentTimeMillis() - entry.createdAt()) > TTL_MILLIS;
    }

    public boolean isMaxAttemptsReached(CodeEntry entry) {
        return entry.attempts() >= MAX_ATTEMPTS;
    }

    private void cleanup() {
        long now = System.currentTimeMillis();
        store.entrySet().removeIf(e -> (now - e.getValue().createdAt()) > TTL_MILLIS);
        lastSendTime.entrySet().removeIf(e -> (now - e.getValue()) > COOLDOWN_MILLIS);
    }
}
