import { test, expect, describe, beforeEach } from "bun:test";
import {
  createDonation,
  getAllDonations,
  getTotalDonations,
  clearDonations,
} from "./donation";

describe("Donation", () => {
  beforeEach(() => {
    clearDonations();
  });

  test("creates a donation with all fields", () => {
    const donation = createDonation({
      amount: 1000,
      donorName: "John Doe",
      message: "Great work!",
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

  test("donations are returned in order", () => {
    createDonation({ amount: 100, donorName: "First" });
    createDonation({ amount: 200, donorName: "Second" });

    const donations = getAllDonations();
    expect(donations[0].donorName).toBe("First");
    expect(donations[1].donorName).toBe("Second");
  });
});
