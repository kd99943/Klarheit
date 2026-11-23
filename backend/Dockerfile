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
FROM eclipse-temurin:21-jre-noble

WORKDIR /app

RUN groupadd -r spring && useradd -r -g spring spring

COPY --from=compiler /app/target/backend-0.0.1-SNAPSHOT.jar app.jar
RUN java -Xshare:dump && \
    java -Djarmode=tools -jar app.jar extract --destination /app/extracted && \
    rm -f app.jar && \
    java -XX:ArchiveClassesAtExit=/app/app-cds.jsa \
         -Dspring.context.exit=onRefresh \
         -Dspring.profiles.active=prod \
         -Dspring.main.lazy-initialization=false \
         -Dspring.data.jpa.repositories.bootstrap-mode=default \
         -Dspring.flyway.enabled=false \
         -Dspring.jpa.hibernate.ddl-auto=none \
         -Dspring.jpa.database-platform=org.hibernate.dialect.MySQLDialect \
         -Dspring.jpa.properties.hibernate.boot.allow_jdbc_metadata_access=false \
         -Dspring.jpa.properties.hibernate.temp.use_jdbc_metadata_defaults=false \
         -Dspring.datasource.url=jdbc:mysql://127.0.0.1:3306/klarheit \
         -Dspring.datasource.username=root \
         -Dspring.datasource.password=root \
         -Dspring.datasource.hikari.minimum-idle=0 \
         -Dspring.datasource.hikari.initialization-fail-timeout=-1 \
         -Dapp.jwt.secret=CdsTrainingSecretKeyMinimum32BytesLong123456 \
         -jar /app/extracted/app.jar && \
    chown -R spring:spring /app

USER spring:spring

EXPOSE 8080

ENV MALLOC_ARENA_MAX=1
ENV MALLOC_TRIM_THRESHOLD_=65536
ENV MALLOC_MMAP_THRESHOLD_=65536

CMD ["sh", "-c", "exec java -XX:SharedArchiveFile=/app/app-cds.jsa -Djava.security.egd=file:/dev/./urandom -Dserver.port=${PORT:-8080} -jar /app/extracted/app.jar"]
