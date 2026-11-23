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

# Generate JDK Class-Data Sharing (CDS) archive so core JDK classes map as file-backed pages instead of anon Metaspace
RUN java -Xshare:dump

# Copy compiled fat JAR and extract into standard unpacked layout to eliminate NestedJarFile anon memory overhead
COPY --from=compiler /app/target/backend-0.0.1-SNAPSHOT.jar app.jar
RUN java -Djarmode=tools -jar app.jar extract --destination /app/extracted && rm -f app.jar

# Design secure OS group and unprivileged execution user
RUN addgroup -S spring && adduser -S spring -G spring && chown -R spring:spring /app
USER spring:spring

EXPOSE 8080

# Use shell form so Railway/Northflank $PORT env var is expanded at runtime.
CMD ["sh", "-c", "exec java -Djava.security.egd=file:/dev/./urandom -Dserver.port=${PORT:-8080} -jar /app/extracted/app.jar"]
