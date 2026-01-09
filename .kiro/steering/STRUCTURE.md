---
inclusion: always
---

# RGB Product Structure

## Overview
RGB is a multiplayer color communication game built as a modern web application with serverless backend infrastructure, focusing on HSL color space interaction.

## Architecture

### Monorepo Structure
- **Root**: Workspace management and shared configuration
- **Client**: React/TypeScript frontend application
- **Service**: AWS CDK infrastructure and Lambda functions

### Frontend (Client)
- **Technology**: React with TypeScript
- **Purpose**: Interactive game interface for color selection and multiplayer interaction
- **Key Requirements**: 
  - Full HSL color picker support with complete spectrum access
  - Real-time multiplayer communication
  - Responsive design for various devices

### Backend (Service)
- **Technology**: AWS CDK with TypeScript Lambda functions
- **Infrastructure**: Serverless architecture on AWS
- **Components**:
  - Lambda functions for game logic
  - WebSocket support for real-time communication
  - DynamoDB for game state persistence

## Development Workflow
- **Build**: `npm run build` - Compiles all workspaces
- **Development**: Separate dev servers for client and service
- **Deployment**: CDK-managed infrastructure deployment

## Core Game Principle
The game centers on color-based communication where players must be able to select any valid HSL color value. This flexibility is essential to the gameplay mechanics.
