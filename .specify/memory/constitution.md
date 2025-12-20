# Project Constitution

## Project Overview

This is a Bun-based donation management system using spec-driven development.

## Core Principles

1. **Usage-First Development**: Write usage examples before implementation
2. **Spec-Driven Design**: Define specifications before coding
3. **Test-First Approach**: Tests define expected behavior
4. **Simple & Minimal**: Keep implementations minimal and focused
5. **Bun-Native**: Use Bun's native APIs and features

## Technology Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Testing**: bun:test (built-in)
- **Server**: Bun.serve()
- **Database**: bun:sqlite (when needed)

## Development Workflow

1. **Specify**: Define what to build using `/speckit.specify`
2. **Plan**: Create technical plan using `/speckit.plan`
3. **Tasks**: Break down into tasks using `/speckit.tasks`
4. **Implement**: Build the feature using `/speckit.implement`

## Code Standards

- Use TypeScript strict mode
- Follow functional programming principles where appropriate
- Keep functions small and focused
- Write self-documenting code
