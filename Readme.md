# TicketFlow 🎟️

**A High-Concurrency, Event-Driven Seat Booking Architecture**

TicketFlow is an event-driven booking platform designed to handle the chaos of high-demand reservations using a production-ready architecture:

* **Redis:** Atomic seat locking to completely prevent race conditions and double-booking.
* **Socket.io:** Real-time UI synchronization that instantly changes seat colors and blocks availability for all users the moment someone else selects a seat.
* **Apache Kafka:** Event-streaming backbone that decouples the main API from background tasks to maintain ultra-fast checkouts.
* **RabbitMQ:** Reliable message broker for the notification system, handling asynchronous email delivery, automated retries, and failed message routing.
* **Prometheus & Grafana:** Real-time observability for system health, load metrics, and network throughput.
* **k6:** Load testing tool that mathematically proves the architecture sustains extreme traffic spikes.
* **Docker:** Containerizes the distributed database and message brokers, making the complex backend instantly reproducible.

<br>

<div align="center">

![Next JS](https://img.shields.io/badge/Next-black?style=for-the-badge&logo=next.js&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=for-the-badge&logo=redis&logoColor=white)
![Socket.io](https://img.shields.io/badge/Socket.io-black?style=for-the-badge&logo=socket.io&badgeColor=010101)
![Apache Kafka](https://img.shields.io/badge/Apache_Kafka-231F20?style=for-the-badge&logo=apachekafka&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/Rabbitmq-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)
![Prometheus](https://img.shields.io/badge/Prometheus-E6522C?style=for-the-badge&logo=Prometheus&logoColor=white)
![Grafana](https://img.shields.io/badge/Grafana-F46800?style=for-the-badge&logo=grafana&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)
![k6](https://img.shields.io/badge/k6-7D64FF?style=for-the-badge&logo=k6&logoColor=white)

</div>

## Table of Contents

* [Demo & UI Preview](#demo--ui-preview)
* [Architecture ](#architecture)
* [System Flow](#system-flow)
* [⚡ Performance & Load Testing](#performance--load-testing)
* [API Endpoints](#api-endpoints)
* [Data Models](#data-models)
* [🚀 Local Setup](#-local-setup)


---
## Demo & UI Preview

Ticketo lets users browse events, lock seats, pay, and receive a verifiable QR-code ticket over email — all without double-booking. The core challenge is seat inventory: multiple users hitting "Book" at the same time for the last few seats. Solving that cleanly, without pessimistic DB locks killing throughput, is what shaped every major architectural decision in this project.

[👉 HIGHLIGHT THIS ENTIRE LINE AND DRAG/DROP YOUR VIDEO FILE HERE 👈]


| Booking Detail | QR Code |
| :---: | :---: |
| <a href="docs/email.png"><img src="docs/email.png" width="100%" alt="Booking Detail"/></a> | <a href="docs/qrcode.png"><img src="docs/qrcode.png" width="100%" alt="QR Code"/></a> |
<p align="center">
  <sub>
    Click any image to enlarge 
  </sub>
</p>

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client (Next.js)                           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP / WebSocket
┌──────────────────────────────▼──────────────────────────────────────┐
│                         API Server (Node.js)                        │
│                                                                     │
│   ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│   │  Auth (JWT)  │    │ Booking API  │    │   Event / Seat API   │  │
│   └──────────────┘    └──────┬───────┘    └──────────────────────┘  │
└──────────────────────────────┼──────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
┌─────────▼──────┐   ┌─────────▼──────┐   ┌────────▼───────┐
│   Redis        │   │  PostgreSQL    │   │  Stripe API    │
│  Seat Locking  │   │  (Prisma ORM)  │   │  Payments      │
│  (TTL Locks)   │   │                │   │                │
└────────────────┘   └────────────────┘   └────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                        Apache Kafka                                 │
│              (booking.created / booking.confirmed)                  │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                     Notification Service                            │
│                                                                     │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │                      RabbitMQ                                │  │
│   │   main queue ──► consumer ──► email sender                   │  │
│   │                      │                                       │  │
│   │                  DLQ (Dead Letter Queue)                     │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                           │                                         │
│              ┌────────────▼────────────┐                            │
│              │  Email (base64 QR code) │                            │
│              │  Single-scan verified   │                            │
│              |_________________________|                            │
└─────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│               Observability (Prometheus + Grafana)                  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## System Flow

### 1. Comprehensive Event-Driven Booking Flow
```mermaid
flowchart TD
    %% Phase 1: Locking & Initiation
    A([User selects seats]) --> B{Redis Lua Script<br/>Atomic Lock TTL: 300s}
    B -- Failed (Already Locked) --> C([Reject: 'Seat Unavailable'])
    B -- Success --> D[Socket.io: Broadcast 'locked' status]
    D --> E[Kafka: Publish 'booking.initiated']

    %% Phase 2: Payment & Expiry Branches
    E --> F{Stripe Payment Checkout}

    %% Expiry Edge Case
    F -. User Abandons / Timeout .-> G[Redis Keyspace Notification<br/>__keyevent@0__:expired]
    G --> H[Kafka: Publish 'seat_lock_expired']
    H --> I[Socket.io: Broadcast 'available' status]

    %% Payment Fail
    F -- Payment Fails --> J[Kafka: Publish 'payment.failed']
    J --> K[Clear Redis Lock]
    K --> I

    %% Payment Success
    F -- Payment Success --> L[Kafka: Publish 'payment.confirmed']

    %% Phase 3: Transaction & Notification
    L --> M[(PostgreSQL $transaction)]
    M --> N[Commit Booking & Mark Seats 'booked']
    N --> O[Socket.io: Broadcast 'booked' status]
    N --> P[Kafka: Publish 'notification.requested']

    P --> Q[Notification Consumer<br/>Reads with Manual Offset]
    Q --> R{RabbitMQ Queue<br/>'notify'}

    R -- Email Worker Success --> S([Email Sent with Base64 QR])
    R -- Fails 3x Retries --> T[(Dead Letter Queue - DLQ)]

```

### 2. QR Ticket Verification Flow
```mermaid
flowchart TD
    A([Venue scanner hits /verify<br/>with booking ID]) --> B{Check booking.scanned}
    
    B -- false (Not scanned) --> C[Mark scanned = true<br/>Record scannedAt timestamp]
    B -- true (Already scanned) --> D([Reject: Ticket already used])
    
    C --> E([Entry Granted ✓])
```

---
## ⚡ Performance & Load Testing

The system was load-tested using **k6** with **1,000 concurrent Virtual Users (VUs)** simulating the complete booking workflow:

> **Login → Browse Events → Select Seats → Lock Seat → Confirm Booking**

**Test Environment**

* Intel Core **i7 12th Generation** laptop
* Docker-based local deployment
* Redis for distributed seat locking
* Kafka for asynchronous event processing
* Prometheus + Grafana for observability

> **Note:** All benchmarks were collected on a **single local machine** running Docker containers. Production deployments with horizontal scaling and dedicated infrastructure would support substantially higher throughput.

### Results (All Thresholds Passed)

| Metric                 | Threshold | Result       |
| ---------------------- | --------- | ------------ |
| HTTP p95 latency       | < 2000 ms | ✅ **172 ms** |
| HTTP error rate        | < 10%     | ✅ **4.65%**  |
| Seat lock success rate | > 5%      | ✅ **81.38%** |
| Seat lock p95 duration | < 1000 ms | ✅ **349 ms** |

**Overall Test Statistics**

* ✅ **105,020 / 105,020 checks passed (100%)**
* 🌐 **70,015 HTTP requests**
* 🚀 **312 requests/sec peak throughput**
* 👥 **1,000 concurrent Virtual Users (VUs)**
* 🔁 **17,503 completed booking iterations**

### Why Some Requests Are Reported as "Failed"

The reported **4.65% HTTP error rate** does **not** indicate application instability.

During contention, many Virtual Users intentionally attempt to lock the **same seat** simultaneously. Redis performs an **atomic lock operation**, allowing only the first request to acquire the lock while the remaining requests receive an expected **HTTP 409 Conflict** response.

k6 counts these expected conflict responses as failed HTTP requests, even though the system behaves exactly as designed.

Likewise, approximately **19% of seat-lock attempts are rejected by design**, preventing duplicate bookings rather than representing system failures.

---

## 📊 Real-Time Observability (Prometheus + Grafana)

While k6 generated load, **Prometheus** continuously scraped backend metrics every **15 seconds**, and **Grafana** visualized them in real time.

The dashboard monitored:

* **Total Seat Locks** (`ticket_booking_seat_locks_total`)
  Stable increase throughout the test with no crashes or service restarts.

* **Seat Lock Failures** (`ticket_booking_seat_lock_fails_total`)
  Predictable plateau at roughly **3,200 expected Redis lock rejections**, confirming deterministic conflict handling instead of timeouts.

* **HTTP Request Rate**
  Peak throughput reached approximately **160 requests/sec** before cleanly draining after the load test completed.

* **HTTP Response Time (p95)**
  Remained consistently flat throughout the test, demonstrating stable latency under sustained concurrent load and negligible monitoring overhead.

---

## ⚡ Kafka Pipeline Under Burst Load

After a seat lock succeeds, the backend immediately publishes a **`booking.init`** event to Kafka.

A downstream consumer asynchronously processes:

* Booking finalization
* Email notifications
* Additional background tasks

This event-driven architecture keeps the HTTP request lightweight, allowing users to receive a response immediately instead of waiting for slower background operations.

During the 1,000-VU load test, Grafana reported approximately **120 Kafka events/sec** at peak throughput. After traffic stopped, the consumer successfully processed every remaining event with **zero observable consumer lag**.

Scaling this pipeline typically involves adding additional Kafka consumer instances (with sufficient topic partitions) without changing the application's business logic.

---

## 📸 Screenshots

<p align="center">
  <a href="docs/k6-thresholds.png">
    <img src="docs/k6-thresholds.png" width="22%" alt="k6 thresholds and total results"/>
  </a>
  &nbsp;
  <a href="docs/k6-detailed-stats.png">
    <img src="docs/k6-detailed-stats.png" width="22%" alt="k6 detailed HTTP and execution metrics"/>
  </a>
  &nbsp;
  <a href="docs/grafana-dashboard.png">
    <img src="docs/grafana-dashboard.png" width="22%" alt="Grafana monitoring dashboard"/>
  </a>
  &nbsp;
  <a href="docs/kafka-events.png">
    <img src="docs/kafka-events.png" width="22%" alt="Kafka events per second"/>
  </a>
</p>

<p align="center">
  <sub>
    Click any image to enlarge • k6 thresholds • k6 execution statistics • Grafana monitoring dashboard • Kafka events/sec
  </sub>
</p>
---

## API Endpoints

The REST API is strictly organized by domain. Sensitive endpoints are secured via JWT authentication, while critical actions (like login and email delivery) are rate-limited to prevent abuse.

### Authentication (`/api/auth`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Create a new user account | Public |
| `POST` | `/login` | Authenticate user & receive JWT | Public (Rate Limited) |
| `POST` | `/admin/login`| Authenticate admin & receive JWT | Public (Rate Limited) |

### Events (`/api/events`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET`  | `/` | Retrieve list of all upcoming events | Public |
| `GET`  | `/:id` | Retrieve specific event details | Public |
| `POST` | `/` | Create a new event & generate seat layout | **Admin** |

### Seats (`/api/seats`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET`  | `/events/:id/seats`| Retrieve real-time seat availability | Public |
| `POST` | `/lock-many` | Acquire atomic Redis lock on selected seats | User |
| `DELETE`| `/lock-many`| Manually release Redis lock on seats | User |

### Bookings (`/api/bookings`)
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET`  | `/me` | Retrieve current user's booking history | User |
| `GET`  | `/:id` | Retrieve specific booking & QR details | User |
| `GET`  | `/verify/:id` | Validate QR ticket scan at venue entry | **Admin** |
| `POST` | `/:id/resend-email`| Enqueue RabbitMQ job to resend QR ticket | User (Rate Limited) |

### Payments & Observability
| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/webhook` | Stripe asynchronous payment confirmation | Stripe Signature |
| `GET`  | `/metrics` | Exposes application metrics for Grafana | Prometheus |




---

## Data Models

The database is structured to strictly separate seat inventory from user booking records. This separation is what allows the system to utilize temporary Redis locks without causing database bottlenecks.

### Entity Relationship Diagram
```mermaid
erDiagram
    User ||--o{ Booking : "places"
    Event ||--|{ Seat : "contains"
    Event ||--o{ Booking : "receives"
    Booking ||--|{ BookingSeat : "reserves"
    Seat ||--o| BookingSeat : "claimed by"

    User {
        String id PK
        String email UK
        String password
        String name
        String role
        DateTime createdAt
    }
    Event {
        String id PK
        String title
        String description
        DateTime eventDate
        String venue
        Int totalSeats
        Int rowCount
        Int seatsPerRow
        Int pricePerSeat
        DateTime createdAt
    }
    Seat {
        String id PK
        String eventId FK
        String rowLabel
        Int seatNumber
        String status
    }
    Booking {
        String id PK
        String userId FK
        String eventId FK
        String status
        Int totalAmount
        Boolean scanned
        DateTime scannedAt
        Boolean emailSent
        DateTime bookedAt
    }
    BookingSeat {
        String id PK
        String bookingId FK
        String seatId FK "Unique"
    }


```
   
---

## 🚀 Local Setup 

TicketFlow uses **Docker** to orchestrate all required infrastructure, including **PostgreSQL**, **Redis**, **Apache Kafka**, and **RabbitMQ**, allowing you to get the entire distributed system running with just a few commands.

### 📋 Prerequisites

Before getting started, ensure you have the following installed:

- **Node.js** (v18 or later)
- **Docker & Docker Compose**
- **Git**

---

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/SHAKSHYAM23/ticketflow.git
cd ticketflow
```

---

### 2️⃣ Configure Environment Variables

Create a `.env` file in the project root and add the following configuration.

> **Note:** You'll need your own **Stripe** and **SMTP** credentials to test payment processing and email notifications.

```env

# Database & Cache

DATABASE_URL="postgresql://postgres:password@localhost:5432/ticketflow?schema=public"
REDIS_URL="redis://localhost:6379"


# Apache Kafka

KAFKA_BROKER="localhost:9092"
KAFKA_CLIENT_ID="ticket-booking"


# RabbitMQ

RABBITMQ_URL="amqp://localhost:5672"


# SMTP (Email Worker)

SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
EMAIL_FROM="Ticket Booking <noreply@ticketbooking.com>"


# Authentication

JWT_SECRET="your-super-secret-jwt-key"


# Stripe

STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

---

### 3️⃣ Start the Infrastructure

Launch PostgreSQL, Redis, Kafka, and RabbitMQ using Docker Compose.

```bash
docker-compose up -d
```

---

### 4️⃣ Configure the Database

Generate the Prisma client and apply the database schema.

```bash
npm run prisma:generate
npx prisma db push
```

---

### 5️⃣ Install Dependencies

```bash
npm install
```

---

### 6️⃣ Start the Application

Run the development server.

```bash
npm run dev
```

This command starts:

- 🚀 Express API Server
- 🔌 Socket.IO Server
- 📩 Email Notification Worker
- 📬 Kafka Consumers
- 📨 RabbitMQ Consumers
- 📊 Metrics Collection

---


## 👨‍💻 Author

**Shakshyam Pandey**

- GitHub: https://github.com/SHAKSHYAM23
- LinkedIn: https://linkedin.com/in/shakshyam-pandey

---
## 💬 Feedback

Thank you for checking out this project!

If you have any questions, suggestions, or feedback, feel free to connect with me on GitHub or LinkedIn. I'd love to hear your thoughts and discuss the project further.