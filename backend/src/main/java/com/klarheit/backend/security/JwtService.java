package com.klarheit.backend.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import java.security.Key;
import java.util.Date;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
    private final Key signingKey;
    private final long expirationMillis;
    private final String issuer;
    private final String audience;

    public JwtService(@Value("${app.jwt.secret}") String secret,
                      @Value("${app.jwt.expiration-millis}") long expirationMillis,
                      @Value("${app.jwt.issuer:klarheit}") String issuer,
                      @Value("${app.jwt.audience:klarheit-web}") String audience) {
        this.signingKey = Keys.hmacShaKeyFor(Decoders.BASE64.decode(secret));
        this.expirationMillis = expirationMillis;
        this.issuer = issuer;
        this.audience = audience;
    }

    public String generateToken(String subject) {
        Date now = new Date();
        return Jwts.builder()
                .subject(subject)
                .issuer(issuer)
                .claim(Claims.AUDIENCE, audience)
                .issuedAt(now)
                .expiration(new Date(now.getTime() + expirationMillis))
                .signWith(signingKey)
                .compact();
    }

    public String extractUsername(String token) {
        return parseClaims(token).getSubject();
    }

    public boolean isTokenValid(String token, String expectedUsername) {
        Claims claims = parseClaims(token);
        return expectedUsername.equalsIgnoreCase(claims.getSubject()) && claims.getExpiration().after(new Date());
    }

    private Claims parseClaims(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(Keys.hmacShaKeyFor(signingKey.getEncoded()))
                .build()
                .parseSignedClaims(token)
                .getPayload();
        // Verify issuer / audience claims to prevent cross-service token replay.
        if (issuer != null && !issuer.equals(claims.getIssuer())) {
            throw new IllegalArgumentException("Invalid JWT issuer: " + claims.getIssuer());
        }
        // Per JWT spec (RFC 7519), the "aud" claim can be a String or a
        // Collection<String>. jjwt 0.12.x may expose it as a Set/List, so a
        // plain String.equals() comparison always fails. Handle both shapes.
        Object tokenAudience = claims.get(Claims.AUDIENCE);
        if (audience != null && tokenAudience != null) {
            boolean matched;
            if (tokenAudience instanceof java.util.Collection<?> collection) {
                matched = collection.contains(audience);
            } else {
                matched = audience.equals(tokenAudience.toString());
            }
            if (!matched) {
                throw new IllegalArgumentException("Invalid JWT audience: " + tokenAudience);
            }
        }
        return claims;
    }
}
