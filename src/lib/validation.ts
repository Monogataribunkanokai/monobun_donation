// Monobun Donation System - Validation Library (No External Dependencies)

// === Validation Result Type ===

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: ValidationError };

export interface ValidationError {
  errors: Array<{ path: string[]; message: string }>;
}

// === Simple Schema Builder ===

interface SchemaDefinition<T> {
  parse: (value: unknown) => T;
  safeParse: (value: unknown) => ValidationResult<T>;
}

function createSchema<T>(
  validator: (value: unknown) => T
): SchemaDefinition<T> {
  return {
    parse: validator,
    safeParse: (value: unknown) => {
      try {
        const data = validator(value);
        return { success: true, data };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Validation failed";
        return {
          success: false,
          error: { errors: [{ path: [], message }] },
        };
      }
    },
  };
}

// === Common Validators ===

// Common passwords list
const COMMON_PASSWORDS = [
  "password123",
  "123456789012",
  "qwertyuiopas",
  "letmein12345",
  "welcome12345",
  "admin1234567",
  "iloveyou1234",
  "sunshine1234",
  "princess1234",
  "football1234",
];

export const emailSchema = createSchema((value: unknown): string => {
  if (typeof value !== "string") throw new Error("Expected string");
  if (value.length > 255) throw new Error("Email must be at most 255 characters");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("Invalid email");
  return value;
});

export const passwordSchema = createSchema((value: unknown): string => {
  if (typeof value !== "string") throw new Error("Expected string");
  if (value.length < 12) throw new Error("Password must be at least 12 characters");
  if (value.length > 128) throw new Error("Password must be at most 128 characters");
  if (!/[A-Z]/.test(value)) throw new Error("Password must contain uppercase, lowercase, and numbers");
  if (!/[a-z]/.test(value)) throw new Error("Password must contain uppercase, lowercase, and numbers");
  if (!/[0-9]/.test(value)) throw new Error("Password must contain uppercase, lowercase, and numbers");
  if (COMMON_PASSWORDS.includes(value.toLowerCase())) throw new Error("Password is too common");
  return value;
});

// === Auth Schemas ===

export const LoginSchema = createSchema((value: unknown): { email: string; password: string; captchaToken?: string } => {
  if (typeof value !== "object" || value === null) throw new Error("Expected object");
  const obj = value as Record<string, unknown>;

  const email = emailSchema.parse(obj.email);
  if (typeof obj.password !== "string" || obj.password.length === 0) {
    throw new Error("password: String must contain at least 1 character(s)");
  }
  if (obj.password.length > 128) throw new Error("password: Password too long");
  const password = obj.password;

  const result: { email: string; password: string; captchaToken?: string } = { email, password };
  if (obj.captchaToken !== undefined) {
    if (typeof obj.captchaToken !== "string") throw new Error("captchaToken must be string");
    result.captchaToken = obj.captchaToken;
  }

  return result;
});

export const PasswordChangeSchema = createSchema((
  value: unknown
): { currentPassword?: string; newPassword: string; tempToken?: string } => {
  if (typeof value !== "object" || value === null) throw new Error("Expected object");
  const obj = value as Record<string, unknown>;

  const newPassword = passwordSchema.parse(obj.newPassword);

  const result: { currentPassword?: string; newPassword: string; tempToken?: string } = { newPassword };

  if (obj.currentPassword !== undefined) {
    if (typeof obj.currentPassword !== "string") throw new Error("currentPassword must be string");
    result.currentPassword = obj.currentPassword;
  }
  if (obj.tempToken !== undefined) {
    if (typeof obj.tempToken !== "string") throw new Error("tempToken must be string");
    result.tempToken = obj.tempToken;
  }

  if (!result.currentPassword && !result.tempToken) {
    throw new Error("Either currentPassword or tempToken is required");
  }

  return result;
});

export const PasswordResetRequestSchema = createSchema((value: unknown): { email: string } => {
  if (typeof value !== "object" || value === null) throw new Error("Expected object");
  const obj = value as Record<string, unknown>;
  return { email: emailSchema.parse(obj.email) };
});

export const PasswordResetConfirmSchema = createSchema((value: unknown): { token: string; newPassword: string } => {
  if (typeof value !== "object" || value === null) throw new Error("Expected object");
  const obj = value as Record<string, unknown>;

  if (typeof obj.token !== "string") throw new Error("token is required");
  if (obj.token.length < 32 || obj.token.length > 128) throw new Error("Invalid token format");

  return {
    token: obj.token,
    newPassword: passwordSchema.parse(obj.newPassword),
  };
});

// === Donation Types ===

export type DonationType = "one-time" | "monthly" | "yearly" | "event";
export type PaymentMethod = "card" | "paypay" | "bank_transfer";

const DONATION_TYPES = ["one-time", "monthly", "yearly", "event"] as const;
const PAYMENT_METHODS = ["card", "paypay", "bank_transfer"] as const;

export const DonationSchema = createSchema((value: unknown): {
  type: DonationType;
  amount: number;
  paymentMethod: PaymentMethod;
  eventId?: string | null;
  donor: { email: string; name?: string };
  message?: string;
} => {
  if (typeof value !== "object" || value === null) throw new Error("Expected object");
  const obj = value as Record<string, unknown>;

  // Validate type
  if (!DONATION_TYPES.includes(obj.type as DonationType)) {
    throw new Error("type: Invalid donation type");
  }
  const type = obj.type as DonationType;

  // Validate amount
  if (typeof obj.amount !== "number" || !Number.isInteger(obj.amount)) {
    throw new Error("amount: Expected integer");
  }
  if (obj.amount < 100) throw new Error("amount: Number must be greater than or equal to 100");
  if (obj.amount > 10_000_000) throw new Error("amount: Number must be less than or equal to 10000000");
  const amount = obj.amount;

  // Validate payment method
  if (!PAYMENT_METHODS.includes(obj.paymentMethod as PaymentMethod)) {
    throw new Error("paymentMethod: Invalid payment method");
  }
  const paymentMethod = obj.paymentMethod as PaymentMethod;

  // Validate eventId (optional)
  let eventId: string | null | undefined;
  if (obj.eventId !== undefined && obj.eventId !== null) {
    if (typeof obj.eventId !== "string") throw new Error("eventId: Expected string");
    if (!/^[a-z0-9-]+$/.test(obj.eventId)) throw new Error("eventId: Invalid");
    if (obj.eventId.length > 100) throw new Error("eventId: Too long");
    eventId = obj.eventId;
  }

  // Validate donor
  if (typeof obj.donor !== "object" || obj.donor === null) {
    throw new Error("donor: Expected object");
  }
  const donorObj = obj.donor as Record<string, unknown>;
  const donorEmail = emailSchema.parse(donorObj.email);
  let donorName: string | undefined;
  if (donorObj.name !== undefined) {
    if (typeof donorObj.name !== "string") throw new Error("donor.name: Expected string");
    if (donorObj.name.length > 100) throw new Error("donor.name: Too long");
    donorName = donorObj.name;
  }

  // Validate message (optional)
  let message: string | undefined;
  if (obj.message !== undefined) {
    if (typeof obj.message !== "string") throw new Error("message: Expected string");
    if (obj.message.length > 1000) throw new Error("message: Too long");
    message = obj.message;
  }

  const result: {
    type: DonationType;
    amount: number;
    paymentMethod: PaymentMethod;
    eventId?: string | null;
    donor: { email: string; name?: string };
    message?: string;
  } = {
    type,
    amount,
    paymentMethod,
    donor: { email: donorEmail },
  };

  if (eventId !== undefined) result.eventId = eventId;
  if (donorName) result.donor.name = donorName;
  if (message) result.message = message;

  return result;
});

// === Subscription Schema ===

export const SubscriptionSchema = createSchema((value: unknown): {
  type: "monthly" | "yearly";
  amount: number;
  paymentMethod: PaymentMethod;
  donor: { email: string; name?: string };
} => {
  if (typeof value !== "object" || value === null) throw new Error("Expected object");
  const obj = value as Record<string, unknown>;

  // Validate type
  if (obj.type !== "monthly" && obj.type !== "yearly") {
    throw new Error("type: Invalid enum value");
  }
  const type = obj.type;

  // Validate amount
  if (typeof obj.amount !== "number" || !Number.isInteger(obj.amount)) {
    throw new Error("amount: Expected integer");
  }
  if (obj.amount < 100) throw new Error("amount: Number must be greater than or equal to 100");
  if (obj.amount > 10_000_000) throw new Error("amount: Number must be less than or equal to 10000000");
  const amount = obj.amount;

  // Validate payment method
  if (!PAYMENT_METHODS.includes(obj.paymentMethod as PaymentMethod)) {
    throw new Error("paymentMethod: Invalid payment method");
  }
  const paymentMethod = obj.paymentMethod as PaymentMethod;

  // Validate donor
  if (typeof obj.donor !== "object" || obj.donor === null) {
    throw new Error("donor: Expected object");
  }
  const donorObj = obj.donor as Record<string, unknown>;
  const donorEmail = emailSchema.parse(donorObj.email);
  let donorName: string | undefined;
  if (donorObj.name !== undefined) {
    if (typeof donorObj.name !== "string") throw new Error("donor.name: Expected string");
    if (donorObj.name.length > 100) throw new Error("donor.name: Too long");
    donorName = donorObj.name;
  }

  const result: {
    type: "monthly" | "yearly";
    amount: number;
    paymentMethod: PaymentMethod;
    donor: { email: string; name?: string };
  } = {
    type,
    amount,
    paymentMethod,
    donor: { email: donorEmail },
  };

  if (donorName) result.donor.name = donorName;

  return result;
});

// === Event Schema ===

export interface PriceOption {
  label: string;
  amount: number | null;
}

export const EventSchema = createSchema((value: unknown): {
  id: string;
  name: string;
  description?: string;
  goalAmount?: number;
  priceOptions: PriceOption[];
  startsAt?: string;
  endsAt?: string;
} => {
  if (typeof value !== "object" || value === null) throw new Error("Expected object");
  const obj = value as Record<string, unknown>;

  // Validate id
  if (typeof obj.id !== "string") throw new Error("id: Expected string");
  if (!/^[a-z0-9-]+$/.test(obj.id)) throw new Error("id: Invalid");
  if (obj.id.length < 1 || obj.id.length > 100) throw new Error("id: Must be 1-100 characters");
  const id = obj.id;

  // Validate name
  if (typeof obj.name !== "string") throw new Error("name: Expected string");
  if (obj.name.length < 1 || obj.name.length > 255) throw new Error("name: Must be 1-255 characters");
  const name = obj.name;

  // Validate priceOptions
  if (!Array.isArray(obj.priceOptions)) throw new Error("priceOptions: Expected array");
  if (obj.priceOptions.length < 1) throw new Error("priceOptions: Array must contain at least 1 element(s)");
  if (obj.priceOptions.length > 10) throw new Error("priceOptions: At most 10 options allowed");

  const priceOptions: PriceOption[] = [];
  for (const opt of obj.priceOptions) {
    if (typeof opt !== "object" || opt === null) throw new Error("priceOptions: Invalid option");
    const optObj = opt as Record<string, unknown>;
    if (typeof optObj.label !== "string" || optObj.label.length < 1 || optObj.label.length > 50) {
      throw new Error("priceOptions.label: Must be 1-50 characters");
    }
    if (optObj.amount !== null) {
      if (typeof optObj.amount !== "number" || !Number.isInteger(optObj.amount)) {
        throw new Error("priceOptions.amount: Expected integer or null");
      }
      if (optObj.amount < 100 || optObj.amount > 10_000_000) {
        throw new Error("priceOptions.amount: Must be 100-10,000,000");
      }
    }
    priceOptions.push({ label: optObj.label, amount: optObj.amount as number | null });
  }

  const result: {
    id: string;
    name: string;
    description?: string;
    goalAmount?: number;
    priceOptions: PriceOption[];
    startsAt?: string;
    endsAt?: string;
  } = { id, name, priceOptions };

  // Optional fields
  if (obj.description !== undefined) {
    if (typeof obj.description !== "string") throw new Error("description: Expected string");
    if (obj.description.length > 5000) throw new Error("description: Too long");
    result.description = obj.description;
  }

  if (obj.goalAmount !== undefined) {
    if (typeof obj.goalAmount !== "number" || !Number.isInteger(obj.goalAmount)) {
      throw new Error("goalAmount: Expected integer");
    }
    if (obj.goalAmount < 0 || obj.goalAmount > 1_000_000_000) {
      throw new Error("goalAmount: Must be 0-1,000,000,000");
    }
    result.goalAmount = obj.goalAmount;
  }

  if (obj.startsAt !== undefined) {
    if (typeof obj.startsAt !== "string") throw new Error("startsAt: Expected string");
    if (isNaN(Date.parse(obj.startsAt))) throw new Error("startsAt: Invalid date format");
    result.startsAt = obj.startsAt;
  }

  if (obj.endsAt !== undefined) {
    if (typeof obj.endsAt !== "string") throw new Error("endsAt: Expected string");
    if (isNaN(Date.parse(obj.endsAt))) throw new Error("endsAt: Invalid date format");
    result.endsAt = obj.endsAt;
  }

  return result;
});

// === Utility Functions ===

export function validateRequest<T>(
  schema: SchemaDefinition<T>,
  data: unknown
): ValidationResult<T> {
  return schema.safeParse(data);
}

export function formatZodError(error: ValidationError): string {
  return error.errors
    .map((e) => (e.path.length > 0 ? `${e.path.join(".")}: ${e.message}` : e.message))
    .join(", ");
}
