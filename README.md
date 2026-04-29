Klarheit
Klarheit is a full-stack eyewear customization project built to explore a premium optical e-commerce experience from product discovery to prescription-based checkout.

This repository is still under active development. The current version already includes a separated frontend and backend architecture, product catalog flow, authentication foundation, and order submission pipeline, but several features are still being refined before the project is production-ready.

Project Overview
The product vision behind Klarheit is to simulate a modern direct-to-consumer eyewear platform with:

a premium brand-driven landing experience
a product collection page backed by a real backend API
authentication and protected routes
a configuration flow for prescription-based eyewear
a backend order pipeline with persistent storage
This project is being used as a portfolio-grade engineering case study, so the focus is not only on UI polish, but also on clean full-stack structure, API design, modularity, and iterative delivery.

Current Architecture
Frontend
Location: front_end

React 19
TypeScript
Vite
React Router
Tailwind CSS 4
Motion
Frontend responsibilities:

landing page and brand presentation
product browsing
protected user flows
configuration and checkout experience
API integration with the backend
Backend
Location: backend

Java 21
Spring Boot 3
Spring Web
Spring Data JPA
Spring Security
JWT authentication
MySQL
Maven
Backend responsibilities:

user registration and login
JWT-based authentication
product catalog API
order creation and persistence
prescription-related data storage
validation, exception handling, and CORS configuration
Repository Structure
Klarheit/
├─ backend/      Spring Boot backend
├─ front_end/    React + Vite frontend
└─ README.md

Implemented So Far
Frontend and backend are separated into independent applications
Product catalog is served through backend APIs
User registration, login, and current-user retrieval are implemented
Protected routes are used for sensitive flows like config and checkout
Order submission endpoint is present on the backend
Database schema for core optical commerce entities has been defined
Basic backend integration tests already exist
In Progress
The project is not finished yet. Areas currently being improved include:

stronger frontend and backend contract alignment
richer checkout and prescription validation
more complete lens option workflow
production-safe environment configuration
removal of hardcoded local development secrets
better deployment readiness and documentation
improved UX details across config and virtual try-on flows
Core Domain Model
The backend currently revolves around these business entities:

UserAccount
Product
LensOption
Prescription
Order
These support the main user journey of browsing frames, authenticating, configuring lens requirements, and placing an order.

API Snapshot
Current backend API surface includes:

POST /api/v1/auth/register
POST /api/v1/auth/login
GET /api/v1/auth/me
GET /api/v1/products
POST /api/v1/orders/checkout
Local Development
Frontend
cd front_end
npm install
npm run dev
Default dev server:

http://localhost:3000
Backend
cd backend
mvn spring-boot:run
Default backend server:
<img width="2057" height="1258" alt="952A0BCAFB64E7A055A183C023811F5D" src="https://github.com/user-attachments/assets/9e99a8cb-539b-4ed1-9d7a-c2795de911b0" />
<img width="2181" height="928" alt="1F44B0968E3F91BA629F5D5E62B2B73F" src="https://github.com/user-attachments/assets/223de5ae-8514-4777-a9b4-9e4f5f9a7e96" />

http://localhost:8081
Database
The backend is configured for MySQL in local development. Before running the backend, make sure a local database exists and the datasource settings are configured correctly.

Notes
This is the first public upload of the project, so the repository reflects an active build stage rather than a finalized release.
Some implementation details are intentionally still being refactored as the project evolves.
Future commits will focus on stability, cleaner environment management, and deeper business completeness.
Why This Project
Klarheit is meant to demonstrate:

full-stack system decomposition
frontend architecture beyond static pages
backend API and security fundamentals
business-oriented data modeling
iterative engineering workflow on a real product concept
License
No license has been added yet.
