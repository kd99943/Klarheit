# ==========================================
# STAGE 1: Compiler Pipeline
# ==========================================
FROM maven:3.9.9-eclipse-temurin-21-alpine AS compiler

WORKDIR /app

# Speed up subsequent builds by pre-fetching dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy sources and package JVM executable
COPY src ./src
RUN mvn clean package -DskipTests -B

# ==========================================
# STAGE 2: Hardened Non-Root Runtime
# ==========================================
FROM eclipse-temurin:21.0.6_7-jre-alpine

WORKDIR /app

# Design secure OS group and unprivileged execution user
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy production compiled executable from compiler output
COPY --from=compiler /app/target/backend-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 8080

# Use shell form so Railway's $PORT env var is expanded at runtime.
# Falls back to 8080 if PORT is not set (e.g. local docker run).
CMD ["sh", "-c", "java -Djava.security.egd=file:/dev/./urandom -Dserver.port=${PORT:-8080} -jar app.jar"]
