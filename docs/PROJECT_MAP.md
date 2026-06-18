# 🗺️ Project Map — Peta Lengkap File & Dependensi

Dokumen ini berisi peta lengkap semua file dalam proyek, beserta fungsi dan dependensi antar file.

---

## Struktur Lengkap

```
simas-be/
├── docs/                                    # 📚 Dokumentasi proyek
│   ├── README.md                            # Index dokumentasi
│   ├── ARCHITECTURE.md                      # Arsitektur & prinsip desain
│   ├── CODING_STANDARDS.md                  # Standarisasi kode
│   ├── MODULE_GUIDE.md                      # Panduan membuat module baru
│   ├── API_CONVENTIONS.md                   # Konvensi API
│   ├── DATABASE_GUIDE.md                    # Panduan database
│   ├── CHANGELOG.md                         # Riwayat perubahan
│   ├── AI_AGENT_RULES.md                    # Aturan untuk AI agent
│   ├── ENVIRONMENT.md                       # Konfigurasi environment
│   └── PROJECT_MAP.md                       # Dokumen ini
│
├── src/
│   ├── index.ts                             # 🚀 Entry point aplikasi
│   │
│   ├── config/
│   │   ├── config.ts                        # ⚙️ Centralized env config
│   │   ├── database.ts                      # 🗄️ TypeORM DataSource
│   │   └── smtp.ts                          # 📧 Nodemailer transporter
│   │
│   ├── core/
│   │   ├── exceptions/
│   │   │   └── base.ts                      # ❌ Custom exception hierarchy
│   │   │
│   │   ├── helpers/
│   │   │   ├── auth.ts                      # 🔑 JWT token & Google OAuth
│   │   │   ├── hash.ts                      # 🔒 bcrypt password hashing
│   │   │   ├── logger.ts                    # 📋 Error file logging
│   │   │   ├── mail.ts                      # ✉️ Email sender (SMTP)
│   │   │   ├── minio.ts                     # 📦 MinIO object storage
│   │   │   ├── response.ts                  # 📤 API response formatter
│   │   │   └── validator.ts                 # ✅ Zod validation hook
│   │   │
│   │   ├── interfaces/
│   │   │   └── base.repository.interface.ts # 📋 Base repository interface
│   │   │
│   │   └── middlewares/
│   │       ├── auth.middleware.ts            # 🛡️ JWT Bearer auth
│   │       ├── api-key.middleware.ts         # 🔐 API key auth
│   │       └── token-auth.middleware.ts      # 🎫 JWT via query/header
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.module.ts               # 🔌 DI wiring
│   │   │   ├── auth.controller.ts           # 🎮 Auth HTTP handlers
│   │   │   ├── auth.service.ts              # 💼 Auth business logic
│   │   │   ├── validators/
│   │   │   │   └── auth.validator.ts        # ✅ Auth Zod schemas
│   │   │   └── serializers/
│   │   │       └── auth.serialize.ts        # 📤 Auth response shape
│   │   │
│   │   ├── user/
│   │   │   ├── user.module.ts               # 🔌 DI wiring
│   │   │   ├── user.service.ts              # 💼 User business logic
│   │   │   ├── entities/
│   │   │   │   └── user.entity.ts           # 🗄️ User TypeORM entity
│   │   │   ├── interfaces/
│   │   │   │   └── user.repository.interface.ts  # 📋 User repo contract
│   │   │   ├── repositories/
│   │   │   │   └── typeorm-user.repository.ts    # 🗄️ User DB access
│   │   │   └── serializers/
│   │   │       ├── user.serialize.ts              # 📤 User detail shape
│   │   │       └── user-list.serialize.ts         # 📤 User list shape
│   │
│   ├── routes/
│   │   └── api.ts                           # 🛤️ Semua route definitions
│   │
│   └── jobs/
│       └── index.ts                         # ⏰ Placeholder scheduled tasks
│
├── .env                                     # 🔒 Environment variables (git-ignored)
├── .env.dist                                # 📋 Environment template
├── .gitignore                               # Git ignore rules
├── .dockerignore                            # Docker ignore rules
├── Dockerfile                               # 🐳 Multi-stage Docker build
├── docker-compose.yaml                      # 🐳 App + PostgreSQL compose
├── ecosystem.config.js                      # 🔄 PM2 process manager config
├── package.json                             # 📦 Dependencies & scripts
├── bun.lock                                 # 🔒 Bun lockfile
├── tsconfig.json                            # ⚙️ TypeScript configuration
├── swagger.yaml                             # 📖 OpenAPI 3.0 specification
└── README.md                                # 📖 Project README
```

---

## Dependency Graph (Antar File)

### Entry Point

```
src/index.ts
    ├── hono (framework)
    ├── hono/cors
    ├── hono/bun (serveStatic)
    ├── @hono/swagger-ui
    ├── zod (ZodError)
    ├── src/config/database.ts          → AppDataSource
    ├── src/config/config.ts            → config
    ├── src/routes/api.ts               → routes
    ├── src/core/helpers/response.ts    → ApiResponse
    ├── src/core/helpers/logger.ts      → logError
    └── src/core/exceptions/base.ts     → BaseException, ValidatorException
```

### Routes

```
src/routes/api.ts
    ├── src/modules/auth/validators/auth.validator.ts
    ├── src/core/middlewares/auth.middleware.ts
    ├── src/core/helpers/validator.ts
    ├── src/modules/auth/auth.module.ts      → authController
    └── src/core/helpers/minio.ts            → minio (lazy import for proxy)
```

### Auth Module

```
src/modules/auth/auth.module.ts
    ├── src/modules/user/user.module.ts      → userService
    ├── src/modules/auth/auth.service.ts     → AuthService
    └── src/modules/auth/auth.controller.ts  → AuthController

src/modules/auth/auth.service.ts
    ├── src/config/database.ts               → AppDataSource (for transactions)
    ├── src/config/config.ts                 → config
    ├── src/modules/user/entities/user.entity.ts
    ├── src/modules/user/user.service.ts     → UserService (injected)
    ├── src/modules/auth/validators/auth.validator.ts
    ├── src/core/exceptions/base.ts
    ├── src/core/helpers/hash.ts
    ├── src/core/helpers/auth.ts             → AuthHelper
    ├── src/core/helpers/mail.ts             → mail
    └── hono/jwt (verify)

src/modules/auth/auth.controller.ts
    ├── src/modules/auth/auth.service.ts     → AuthService (injected)
    ├── src/modules/auth/serializers/auth.serialize.ts
    ├── src/core/helpers/response.ts         → ApiResponse
    └── src/core/exceptions/base.ts
```

### User Module

```
src/modules/user/user.module.ts
    ├── src/modules/user/repositories/typeorm-user.repository.ts
    └── src/modules/user/user.service.ts

src/modules/user/user.service.ts
    ├── src/modules/user/entities/user.entity.ts
    ├── src/modules/user/interfaces/user.repository.interface.ts  → IUserRepository (injected)
    └── src/core/exceptions/base.ts

src/modules/user/repositories/typeorm-user.repository.ts
    ├── src/config/database.ts               → AppDataSource
    ├── src/modules/user/entities/user.entity.ts
    └── src/modules/user/interfaces/user.repository.interface.ts
```


### Core Helpers

```
src/core/helpers/auth.ts
    ├── hono/jwt (sign)
    ├── google-auth-library (OAuth2Client)
    └── src/config/config.ts

src/core/helpers/mail.ts
    ├── src/config/smtp.ts      → transporter
    └── src/config/config.ts    → config.mail.from

src/core/helpers/minio.ts
    ├── minio (Client)
    ├── node:stream (Readable)
    └── src/config/config.ts

src/core/helpers/response.ts
    ├── hono (Context)
    └── hono/utils/http-status (ContentfulStatusCode)

src/core/middlewares/auth.middleware.ts
    ├── hono/jwt (verify)
    ├── src/config/config.ts
    ├── src/config/database.ts
    ├── src/modules/user/entities/user.entity.ts
    └── src/core/exceptions/base.ts
```

---

## Dependencies (package.json)

### Production

| Package | Versi | Fungsi |
|---------|-------|--------|
| `hono` | ^4.12.8 | Web framework |
| `@hono/swagger-ui` | ^0.6.1 | Swagger UI middleware |
| `@hono/zod-validator` | ^0.7.6 | Zod validation untuk Hono |
| `zod` | ^4.3.6 | Schema validation |
| `typeorm` | ^0.3.28 | ORM |
| `reflect-metadata` | ^0.2.2 | Required by TypeORM decorators |
| `pg` | ^8.16.0 | PostgreSQL driver |
| `mysql2` | ^3.20.0 | MySQL driver |
| `bcryptjs` | ^3.0.3 | Password hashing |
| `nodemailer` | ^8.0.3 | Email sending |
| `google-auth-library` | ^10.7.0 | Google OAuth |
| `minio` | ^8.0.7 | MinIO object storage client |

### Dev Dependencies

| Package | Versi | Fungsi |
|---------|-------|--------|
| `@types/bun` | latest | Bun type definitions |
| `@types/bcryptjs` | ^3.0.0 | bcryptjs type definitions |
| `@types/nodemailer` | ^7.0.11 | Nodemailer type definitions |

---

## NPM Scripts

| Script | Command | Deskripsi |
|--------|---------|-----------|
| `dev` | `bun run --hot src/index.ts` | Development dengan hot-reload |
| `build` | `bun build --minify --outfile dist/index.js --target bun src/index.ts` | Production build |
| `start` | `bun run src/index.ts` | Start dari source |
