# Implement Command

Execute the implementation tasks for a feature.

## Instructions

1. Read the spec file from `.specify/specs/[feature-name].spec.md`
2. Read the plan file from `.specify/specs/[feature-name].plan.md`
3. Read the tasks file from `.specify/specs/[feature-name].tasks.md`
4. Implement each task, following the usage-driven approach

## Implementation Order

1. **Write tests first**: Create test files based on spec
2. **Run tests** (they should fail): `bun test`
3. **Implement minimum code**: Make tests pass
4. **Refactor if needed**: Keep it simple
5. **Verify all tests pass**: `bun test`

## Key Principles

- **Test-Driven**: Tests before implementation
- **Minimal**: Only write code that makes tests pass
- **Incremental**: One task at a time
- **Verify**: Run tests after each change

## Example Flow

```bash
# 1. Write test
# src/donation.test.ts

# 2. Run test (should fail)
bun test src/donation.test.ts

# 3. Implement
# src/donation.ts

# 4. Run test (should pass)
bun test src/donation.test.ts

# 5. Commit
git add . && git commit -m "feat: add donation creation"
```
