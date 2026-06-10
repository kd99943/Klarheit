# Klarheit

Klarheit is a full-stack eyewear customization project built to explore a premium optical e-commerce experience from product discovery to prescription-based checkout.

This repository is still under active development. The current version already includes a separated frontend and backend architecture, product catalog flow, authentication foundation, and order submission pipeline, but several features are still being refined before the project is production-ready.

## Project Overview

The product vision behind Klarheit is to simulate a modern direct-to-consumer eyewear platform with:

- a premium brand-driven landing experience
- a product collection page backed by a real backend API
- authentication and protected routes
- a configuration flow for prescription-based eyewear
- a backend order pipeline with persistent storage

This project is being used as a portfolio-grade engineering case study, so the focus is not only on UI polish, but also on clean full-stack structure, API design, modularity, and iterative delivery.

## Current Architecture

### Frontend

Location: [front_end](/C:/Users/17761/Desktop/Klarheit/front_end)

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS 4
- Motion

Frontend responsibilities:

- landing page and brand presentation
- product browsing
- protected user flows
- configuration and checkout experience
- API integration with the backend

### Backend

Location: [backend](/C:/Users/17761/Desktop/Klarheit/backend)

- Java 21
- Spring Boot 3
- Spring Web
- Spring Data JPA
- Spring Security
- JWT authentication
- MySQL
- Maven

Backend responsibilities:

- user registration and login
- JWT-based authentication
- product catalog API
- order creation and persistence
- prescription-related data storage
- validation, exception handling, and CORS configuration

## Repository Structure

```text
Klarheit/
├─ backend/      Spring Boot backend
├─ front_end/    React + Vite frontend
└─ README.md
```

## Implemented So Far

- **Frontend and Backend Separation**: Built as independent React (Vite) and Spring Boot applications.
- **WebAR Virtual Try-On**: Real-time camera stream overlay with face landmark tracking (via MediaPipe Face Landmarker) and 3D glasses model rendering (via Three.js). Supports real-time product switching and screenshot capture.
- **i18n Localization**: Comprehensive translation support for English and Chinese across all key pages, with locale-aware price and date formatting.
- **Advanced Optical Configuration (Config Lab)**: Intuitive step-by-step prescription entry with real-time validation and dynamic lens option fetching from backend APIs.
- **User Authentication & Accounts**: JWT-based sign-in/registration drawer with rate-limiting, and an order history tab displaying personal orders.
- **Payment Gateway Integration**: Secure WeChat Pay and Alipay Sandbox support. Backends process asynchronously signed Webhook signature validations and update database states.
- **Coupon & Promotion Subsystem**: Rules-based promo code validation engine supporting both flat-rate discount amounts and percentage-based deductions. Integrates atomic database updates (`used_count < max_usages`) to prevent concurrency-related over-redemptions.
- **Solid Backend Foundation**: Enterprise-ready Spring Boot design with structured logging, robust exception handlers, and JUnit/Vitest unit and integration test coverage.
- **Database Migration**: Automatic database schema changes and initial data seeding managed by Flyway (MySQL-compatible).
- **Docker Containerization**: Custom Dockerfiles for frontend (Nginx) and backend (Spring Boot), orchestrated via a root `docker-compose.yml` for local replications.

## Current Focus & Future Enhancements

The project is entering production readiness and looking to add features:

- **Admin Portal & Catalog CMS**: Designing administrator views to modify frame availability, update 3D configs, and generate custom coupons dynamically.
- **Email Receipt Delivery**: Configuring active credentials for Resend/SendGrid transactional email servers.
- **Deployment Hardening**: Setting up GitHub Actions CI/CD pipelines for packaging release artifacts.

## Core Domain Model

The backend currently revolves around these business entities:

- `UserAccount`
- `Product`
- `LensOption`
- `Prescription`
- `Order`

These support the main user journey of browsing frames, authenticating, configuring lens requirements, and placing an order.

## API Snapshot

Current backend API surface includes:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/products`
- `POST /api/v1/orders/checkout`

## Local Development

### Frontend

```bash
cd front_end
npm install
npm run dev
```

Default dev server:

- `http://localhost:3000`

### Backend

```bash
cd backend
mvn spring-boot:run
```

Default backend server:

- `http://localhost:8081`

### Database

The backend uses the `local` Spring profile with MySQL. You need MySQL running locally with a `lumina_optics` database.

Create a `backend/.env` file with your MySQL credentials:

```bash
SPRING_PROFILES_ACTIVE=local
SERVER_PORT=8081
DB_URL=jdbc:mysql://localhost:3306/lumina_optics?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC
DB_USERNAME=root
DB_PASSWORD=your-password
DB_DRIVER_CLASS_NAME=com.mysql.cj.jdbc.Driver
APP_JWT_SECRET=your-base64-secret-at-least-32-bytes
JPA_DDL_AUTO=update
```

Template values are documented in [backend/.env.example](/C:/Users/17761/Desktop/Klarheit/backend/.env.example).

**Note:** Tests use H2 in-memory database for speed and isolation. Run tests with `-Dspring.profiles.active=test`.

### Multi-Container Deployment (Docker Compose)

You can spin up the entire stack (React frontend, Spring Boot backend, and MySQL database) with a single command:

```bash
docker-compose up --build -d
```

- **Frontend Web Server**: `http://localhost` (Port 80)
- **Backend API Gateway**: `http://localhost:8080` (Port 8080)
- **MySQL Database Server**: `localhost:3306` (Port 3306, with DB name `klarheit`)

Ensure no other processes are binding to these ports before launching.

## Notes

- This is the first public upload of the project, so the repository reflects an active build stage rather than a finalized release.
- Some implementation details are intentionally still being refactored as the project evolves.
- Future commits will focus on stability, cleaner environment management, and deeper business completeness.

## Why This Project

Klarheit is meant to demonstrate:

- full-stack system decomposition
- frontend architecture beyond static pages
- backend API and security fundamentals
- business-oriented data modeling
- iterative engineering workflow on a real product concept

## License

No license has been added yet.
