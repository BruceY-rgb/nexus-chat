# Slack-like Chat Application

A production-ready real-time chat application built with Next.js, featuring channel-based messaging, direct messages, file attachments, and AI integration through the Model Context Protocol (MCP).

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Database](#database)
- [Deployment](#deployment)
- [API Documentation](#api-documentation)
- [Development](#development)

## Overview

This is a full-featured Slack-like communication platform that provides:

- **Channel-based communication**: Create and manage public/private channels
- **Direct messaging**: Private one-on-one conversations
- **Real-time updates**: WebSocket-powered instant messaging
- **File sharing**: Upload and share files via Alibaba Cloud OSS
- **User authentication**: Secure JWT-based authentication system
- **MCP Integration**: AI-powered capabilities through Model Context Protocol

## Features

### Core Messaging

- Channel creation and management (public and private)
- Direct messages between users
- Thread support for message discussions
- Rich text formatting with Markdown support
- Code block syntax highlighting
- Message reactions
- Unread message indicators

### User Management

- User registration and login
- Profile management with avatar upload
- Online/offline status tracking
- Member search and filtering
- Session management with JWT

### File Handling

- Drag-and-drop file upload
- Support for images, PDFs, and text files
- Alibaba Cloud OSS integration
- Configurable file size limits
- Type validation

### Notifications

- Real-time notification delivery
- Desktop notifications
- Email notifications (via Resend)
- Configurable notification preferences

### AI Integration (MCP)

- Model Context Protocol server integration
- HTTP mode for external API access
- Scalable MCP instance deployment

## Technology Stack

### Frontend

- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **State Management**: Zustand
- **Real-time**: Socket.io Client

### Backend

- **Runtime**: Node.js 20+
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Real-time**: Socket.io
- **Authentication**: JWT
- **Validation**: Zod

### Infrastructure

- **Containerization**: Docker
- **Deployment**: Dokploy / Custom Docker Compose
- **Reverse Proxy**: Traefik / Nginx
- **Cloud Storage**: Alibaba Cloud OSS

### Additional Services

- **Email**: Resend
- **AI**: MCP (Model Context Protocol)

## Project Structure

```
/slack-chat
├── mcp-server/              # MCP Server implementation
│   ├── src/
│   │   ├── index.ts        # Next.js server entry
│   │   └── server-http.ts  # MCP HTTP server
│   └── prisma/             # MCP server database
├── src/                    # Main application source
│   ├── app/               # Next.js App Router pages
│   │   ├── api/          # API routes
│   │   └── (pages)/      # Page components
│   ├── components/       # React components
│   ├── stores/           # Zustand stores
│   ├── hooks/            # Custom React hooks
│   └── lib/              # Utilities
├── prisma/                # Database schema
├── scripts/               # Build and deployment scripts
├── electron/              # Desktop app (legacy)
├── docs/                  # Documentation
└── docker-compose*.yml    # Docker configurations
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 14+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate
```

### Development

```bash
# Run database migrations
npm run db:migrate

# Seed database with sample data
npm run db:seed

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`.

### Production Build

```bash
# Build Next.js application
npm run build

# Start production server
npm start
```

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/slack_chat"

# JWT Authentication
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# Application
NODE_ENV=development
PORT=3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# WebSocket
WEBSOCKET_PORT=3001

# MCP Server
MCP_PORT=3002
MCP_MODE=http

# Email (Resend)
RESEND_API_KEY="re_xxx"
EMAIL_FROM="Chat <noreply@example.com>"

# File Storage (Alibaba Cloud OSS)
OSS_REGION="oss-cn-hangzhou"
OSS_ACCESS_KEY_ID="your-key"
OSS_ACCESS_KEY_SECRET="your-secret"
OSS_BUCKET="your-bucket"
```

### Port Configuration

| Service | Default Port | Description |
|---------|-------------|-------------|
| Next.js App | 3000 | Main web application |
| WebSocket | 3001 | Real-time messaging |
| MCP Server | 3002 | AI integration |

See [PORT_SOURCE_CODE_REFERENCE.md](./PORT_SOURCE_CODE_REFERENCE.md) for detailed port management instructions.

## Database

### Schema

The database uses Prisma ORM with the following main models:

- **User**: Authentication and profile data
- **Channel**: Communication channels
- **Message**: Channel and direct messages
- **Thread**: Message threading
- **Reaction**: Message reactions
- **File**: File attachments
- **Notification**: User notifications

### Commands

```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Push schema to database
npm run db:push

# Seed database
npm run db:seed

# Seed with large dataset
npm run db:seed:large

# Open Prisma Studio
npm run db:studio
```

## Deployment

### Docker Deployment

The project includes multiple Docker Compose configurations:

```bash
# Development
docker-compose -f docker-compose.dev.yml up -d

# Production with Dokploy
docker-compose -f docker-compose.dokploy.yml up -d

# Full stack
docker-compose up -d
```

### Required Services

- PostgreSQL database
- Traefik (reverse proxy)
- Optional: Redis for caching

### Build MCP Server

```bash
npm run mcp:build
```

## API Documentation

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/session` - Get current session

### Channels

- `GET /api/channels` - List all channels
- `POST /api/channels` - Create channel
- `GET /api/channels/[id]` - Get channel details
- `PUT /api/channels/[id]` - Update channel
- `DELETE /api/channels/[id]` - Delete channel

### Messages

- `GET /api/channels/[id]/messages` - Get channel messages
- `POST /api/channels/[id]/messages` - Send message
- `PUT /api/messages/[id]` - Update message
- `DELETE /api/messages/[id]` - Delete message

### Users

- `GET /api/users` - List users
- `GET /api/users/[id]` - Get user profile
- `PUT /api/users/[id]` - Update profile

### Files

- `POST /api/upload` - Upload file
- `GET /api/files/[id]` - Get file

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Type Checking

```bash
# Check TypeScript types
npm run type-check
```

### Linting

```bash
# Run ESLint
npm run lint
```

### Database Reset

```bash
# Reset database (WARNING: This will delete all data)
npm run db:reset
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License

## Support

For issues and questions, please open a GitHub issue.
