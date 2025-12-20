// Donation types
export interface DonationInput {
  amount: number;
  donorName?: string;
  message?: string;
}

export interface Donation {
  id: string;
  amount: number;
  donorName: string;
  message?: string;
  createdAt: string;
}

// In-memory storage
let donations: Donation[] = [];

// Generate unique ID
function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "don_";
  for (let i = 0; i < 12; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

// Create a new donation
export function createDonation(input: DonationInput): Donation {
  if (input.amount <= 0) {
    throw new Error("Amount must be positive");
  }

  const donation: Donation = {
    id: generateId(),
    amount: input.amount,
    donorName: input.donorName || "Anonymous",
    message: input.message,
    createdAt: new Date().toISOString(),
  };

  donations.push(donation);
  return donation;
}

// Get all donations
export function getAllDonations(): Donation[] {
  return [...donations];
}

// Get total donation amount
export function getTotalDonations(): number {
  return donations.reduce((sum, d) => sum + d.amount, 0);
}

// Clear all donations (for testing)
export function clearDonations(): void {
  donations = [];
}
