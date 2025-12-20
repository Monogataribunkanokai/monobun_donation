# Feature Specification: Donation

## Overview

A simple donation system that allows creating, retrieving, and managing donations.

## Usage Examples

```typescript
// Example 1: Create a donation
import { createDonation } from "./src/donation";

const donation = createDonation({
  amount: 1000,
  donorName: "John Doe",
  message: "Keep up the great work!"
});

console.log(donation);
// {
//   id: "don_abc123",
//   amount: 1000,
//   donorName: "John Doe",
//   message: "Keep up the great work!",
//   createdAt: "2025-12-20T12:00:00.000Z"
// }
```

```typescript
// Example 2: Anonymous donation
import { createDonation } from "./src/donation";

const donation = createDonation({
  amount: 500
});

console.log(donation.donorName);
// "Anonymous"
```

```typescript
// Example 3: Get all donations
import { getAllDonations } from "./src/donation";

const donations = getAllDonations();
console.log(donations.length); // 2
console.log(donations[0].amount); // 1000
```

```typescript
// Example 4: Get total donations
import { getTotalDonations } from "./src/donation";

const total = getTotalDonations();
console.log(total); // 1500
```

## Expected Behavior

### Input

- `amount`: number (required, must be positive)
- `donorName`: string (optional, defaults to "Anonymous")
- `message`: string (optional)

### Output

- `id`: string (unique identifier, prefixed with "don_")
- `amount`: number
- `donorName`: string
- `message`: string | undefined
- `createdAt`: string (ISO date format)

### Edge Cases

- Amount of 0 or negative: Should throw an error
- Empty donor name: Should default to "Anonymous"
- Very large amounts: Should be accepted

## Test Cases

```typescript
import { test, expect, describe, beforeEach } from "bun:test";
import { createDonation, getAllDonations, getTotalDonations, clearDonations } from "./src/donation";

describe("Donation", () => {
  beforeEach(() => {
    clearDonations();
  });

  test("creates a donation with all fields", () => {
    const donation = createDonation({
      amount: 1000,
      donorName: "John Doe",
      message: "Great work!"
    });

    expect(donation.id).toStartWith("don_");
    expect(donation.amount).toBe(1000);
    expect(donation.donorName).toBe("John Doe");
    expect(donation.message).toBe("Great work!");
    expect(donation.createdAt).toBeDefined();
  });

  test("creates anonymous donation when no donor name", () => {
    const donation = createDonation({ amount: 500 });
    expect(donation.donorName).toBe("Anonymous");
  });

  test("throws error for zero amount", () => {
    expect(() => createDonation({ amount: 0 })).toThrow("Amount must be positive");
  });

  test("throws error for negative amount", () => {
    expect(() => createDonation({ amount: -100 })).toThrow("Amount must be positive");
  });

  test("gets all donations", () => {
    createDonation({ amount: 100 });
    createDonation({ amount: 200 });

    const donations = getAllDonations();
    expect(donations.length).toBe(2);
  });

  test("calculates total donations", () => {
    createDonation({ amount: 100 });
    createDonation({ amount: 200 });
    createDonation({ amount: 300 });

    expect(getTotalDonations()).toBe(600);
  });
});
```

## Acceptance Criteria

- [ ] Can create a donation with amount, donor name, and message
- [ ] Anonymous donations are supported
- [ ] Each donation has a unique ID
- [ ] Invalid amounts throw appropriate errors
- [ ] Can retrieve all donations
- [ ] Can calculate total donation amount

## Dependencies

- None (pure TypeScript)

## Notes

- In-memory storage for simplicity (can be replaced with SQLite later)
- IDs are generated using a simple random string
