package com.klarheit.backend.order;

/**
 * Thrown when a customer attempts to confirm a stale pre-payment quote version
 * after the optician has published a newer revision.
 */
public class QuoteVersionConflictException extends IllegalStateException {
    private final Integer currentQuoteVersion;

    public QuoteVersionConflictException(String message, Integer currentQuoteVersion) {
        super(message);
        this.currentQuoteVersion = currentQuoteVersion;
    }

    public Integer getCurrentQuoteVersion() {
        return currentQuoteVersion;
    }
}
