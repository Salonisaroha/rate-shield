# 🛡️ Rate Shield

A fully customizable, production-ready rate limiting service designed to protect individual APIs with specific rules. Built with Go backend, Redis storage, and an Angular dashboard.

---

## 🌐 Live Demo

**[http://165.232.186.106](http://165.232.186.106)**

> Dashboard is password protected. Contact the project owner for access credentials.

---

## 🎯 What is Rate Shield?

Rate Shield is a **standalone rate limiting microservice**. Instead of writing rate limiting logic inside every app you build, you run Rate Shield as a separate service and all your apps talk to it.

Think of it as a **traffic police** that sits in front of your APIs — it decides who gets through and who gets blocked.

```
Your App (Node / Python / Go)
        ↓
  Rate Shield (:8080)
  GET /check-limit
  Headers: ip=<client_ip>, endpoint=<api_path>
        ↓
  Returns 200 (allow) or 429 (block)
        ↓
  Your App proceeds or rejects the request
```

---

## 🌟 Key Features

- **3 Rate Limiting Algorithms** — Token Bucket, Fixed Window Counter, Sliding Window Counter
- **Per-Endpoint Rules** — Different limits for different APIs
- **Angular Dashboard** — Visual interface to manage rules, view analytics, and monitor activity
- **Live Rate Tester** — Test any endpoint in real time and watch the capacity bar drain
- **Audit Logs** — Full history of every rule change with actor, IP, and timestamp
- **Analytics & Insights** — Auto-refreshing charts for strategy breakdown, risk analysis, and audit activity
- **Real-World Use Cases** — 10 pre-built scenarios (OTP, Login, Payments, etc.) with one-click rule creation
- **Dashboard Authentication** — Password-protected dashboard with Redis-backed session management
- **Language Agnostic** — Works with any backend — Node.js, Python, Go, or any language that can make HTTP requests

---

## 🚀 Supported Rate Limiting Algorithms

| Algorithm | Best For |
|---|---|
| **Token Bucket** | API keys, file uploads, sustained rate enforcement with burst allowance |
| **Fixed Window Counter** | OTP sending, login attempts, signup spam prevention |
| **Sliding Window Counter** | Search/autocomplete, payments, smooth enforcement without boundary bursts |

---

## ⚙️ Real World Use Cases

| Scenario | Strategy | Config |
|---|---|---|
| OTP / SMS Sending | Fixed Window | 3 req / 60s per phone number |
| Login Brute Force | Fixed Window | 5 attempts / 300s per IP |
| Password Reset | Fixed Window | 2 req / 600s per email |
| Public API Free Tier | Token Bucket | 100 tokens, refill 10/min per API key |
| Search / Autocomplete | Sliding Window | 10 req / 1s per IP |
| Payment / Checkout | Sliding Window | 3 req / 10s per user |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go (Golang) |
| Storage | Redis |
| Frontend | Angular 18 |
| Styling | Tailwind CSS |
| Protocol | HTTP + gRPC |

---

## 📋 Prerequisites

- **Go** 1.21 or higher
- **Docker Desktop** (for Redis)
- **Node.js** 18 or higher
- **Angular CLI** (`npm install -g @angular/cli`)

---

## 🚀 Quick Start

**1. Clone the repository**
```bash
git clone https://github.com/salonisaroha/RateShield.git
cd RateShield
```

**2. Start Redis**
```bash
cd rate_shield
docker-compose -f docker-compose-dev.yml up -d
```

**3. Set dashboard password in Redis CLI**
```bash
docker exec -it <redis-container-name> redis-cli
SET dashboard:password yourpassword
```

**4. Setup environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

**5. Run the backend**
```bash
go mod download
go run main.go
# Backend running on http://localhost:8080
```

**6. Run the Angular frontend**
```bash
cd web-angular/rate-shield-angular
npm install
npm start
# Frontend running on http://localhost:4200
```

---

## 🔗 API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/check-limit` | GET | Check rate limit for an IP + endpoint |
| `/rule/list` | GET | List all rules |
| `/rule/add` | POST | Create or update a rule |
| `/rule/delete` | POST | Delete a rule |
| `/rule/search` | GET | Search rules by endpoint |
| `/audit/logs` | GET | Get audit logs with filters |
| `/auth/login` | POST | Dashboard login |
| `/auth/validate` | POST | Validate session token |
| `/auth/logout` | POST | Logout and invalidate session |
