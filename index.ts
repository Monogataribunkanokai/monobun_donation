// Donation Management System
// Using Spec-Driven Development with spec-kit

export {
  createDonation,
  getAllDonations,
  getTotalDonations,
  clearDonations,
  type Donation,
  type DonationInput,
} from "./src/donation";

// Example usage
if (import.meta.main) {
  const { createDonation, getAllDonations, getTotalDonations } = await import(
    "./src/donation"
  );

  console.log("Creating donations...");

  const d1 = createDonation({
    amount: 1000,
    donorName: "Alice",
    message: "Great project!",
  });
  console.log("Donation 1:", d1);

  const d2 = createDonation({
    amount: 500,
    message: "Keep it up!",
  });
  console.log("Donation 2:", d2);

  console.log("\nAll donations:", getAllDonations());
  console.log("Total:", getTotalDonations());
}
