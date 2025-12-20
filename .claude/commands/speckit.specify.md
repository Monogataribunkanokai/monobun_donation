# Specify Command

Create a new feature specification following the usage-driven development approach.

## Instructions

1. Read the spec template from `.specify/templates/spec-template.md`
2. Read the constitution from `.specify/memory/constitution.md`
3. Ask the user what feature they want to specify
4. Create a new spec file in `.specify/specs/[feature-name].spec.md`

## Key Principles

- **Start with usage examples**: Show how the feature will be called
- **Define expected behavior**: What should happen for each input
- **Write test cases first**: Tests define the contract
- **Keep it minimal**: Only specify what's needed

## Output Format

Create a spec file with:
1. Feature overview
2. Usage examples (TypeScript code showing API)
3. Expected behavior
4. Test cases using `bun:test`
5. Acceptance criteria

## Example

```typescript
// Usage example for a donation service
import { createDonation } from "./donation";

const donation = await createDonation({
  amount: 1000,
  donor: "anonymous",
  message: "Keep up the good work!"
});
```
