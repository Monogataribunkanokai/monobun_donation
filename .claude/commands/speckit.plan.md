# Plan Command

Create a technical implementation plan for a specified feature.

## Instructions

1. Read the spec file from `.specify/specs/[feature-name].spec.md`
2. Read the plan template from `.specify/templates/plan-template.md`
3. Read the constitution from `.specify/memory/constitution.md`
4. Create a plan file in `.specify/specs/[feature-name].plan.md`

## Key Principles

- **Keep it simple**: Choose the simplest approach that works
- **Use Bun-native APIs**: Prefer Bun.serve, bun:sqlite, etc.
- **Define file structure**: List all files to create/modify
- **Identify risks**: Note potential issues and mitigations

## Output Format

Create a plan file with:
1. Technical summary
2. Architecture overview
3. Implementation phases
4. File changes table
5. Testing strategy
