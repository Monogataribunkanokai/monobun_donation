import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

// Constants
const FEE_RATE = 0.036; // 3.6%
const MIN_AMOUNT = 100;
const MAX_AMOUNT = 10000000;

// Impact messages for amounts
const IMPACT_MESSAGES: Record<number, { icon: string; message: string }> = {
  500: { icon: "🍙", message: "子ども1人の1日分の食事" },
  1000: { icon: "📚", message: "学用品1セット分" },
  3000: { icon: "🎒", message: "1ヶ月分の教育支援" },
  5000: { icon: "🏠", message: "1週間分の生活支援" },
  10000: { icon: "💪", message: "1ヶ月分の総合支援" },
};

// API helper
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "API error");
  }

  return data;
}

// Validation helpers
function validateEmail(email: string): { valid: boolean; message?: string } {
  if (!email) {
    return { valid: false, message: "メールアドレスを入力してください" };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: "有効なメールアドレスを入力してください" };
  }
  if (email.length > 255) {
    return { valid: false, message: "メールアドレスが長すぎます" };
  }
  return { valid: true };
}

function validateAmount(amount: number): { valid: boolean; message?: string } {
  if (!amount || amount < MIN_AMOUNT) {
    return { valid: false, message: `最低寄付金額は${MIN_AMOUNT}円です` };
  }
  if (amount > MAX_AMOUNT) {
    return { valid: false, message: `最大寄付金額は${MAX_AMOUNT.toLocaleString()}円です` };
  }
  if (!Number.isInteger(amount)) {
    return { valid: false, message: "金額は整数で入力してください" };
  }
  return { valid: true };
}

function validateName(name: string): { valid: boolean; message?: string } {
  if (name.length > 100) {
    return { valid: false, message: "お名前は100文字以内で入力してください" };
  }
  return { valid: true };
}

function validateMessage(message: string): { valid: boolean; message?: string } {
  if (message.length > 1000) {
    return { valid: false, message: "メッセージは1000文字以内で入力してください" };
  }
  return { valid: true };
}

// Types
interface DonationEvent {
  id: string;
  name: string;
  description: string;
  goalAmount: number | null;
  currentAmount?: number;
  donorCount?: number;
  priceOptions: number[] | null;
  impactMessages?: Record<number, string>;
}

type Step = "amount" | "info" | "complete";
type DonationType = "one-time" | "monthly";
type PaymentMethod = "apple_pay" | "google_pay" | "card" | "paypay" | "bank_transfer";

interface ValidationState {
  email: { touched: boolean; valid: boolean; message?: string };
  name: { touched: boolean; valid: boolean; message?: string };
  message: { touched: boolean; valid: boolean; message?: string };
  amount: { valid: boolean; message?: string };
}

// Step Progress Component
function StepProgress({ currentStep }: { currentStep: Step }) {
  const steps = [
    { key: "amount", label: "金額選択", num: "①" },
    { key: "info", label: "情報入力", num: "②" },
    { key: "complete", label: "完了", num: "③" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="step-progress" role="navigation" aria-label="フォームの進捗">
      <div className="step-progress-bar">
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <div
              className={`step-indicator ${
                index < currentIndex
                  ? "completed"
                  : index === currentIndex
                  ? "active"
                  : ""
              }`}
              aria-current={index === currentIndex ? "step" : undefined}
            >
              <span className="step-num">
                {index < currentIndex ? "✓" : step.num}
              </span>
              <span className="step-label">{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`step-connector ${
                  index < currentIndex ? "completed" : ""
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
      {currentStep === "amount" && (
        <p className="step-hint">あと約1分で完了します</p>
      )}
    </div>
  );
}

// Progress Thermometer Component
function ProgressThermometer({
  current,
  goal,
  donorCount,
}: {
  current: number;
  goal: number;
  donorCount?: number;
}) {
  const percentage = Math.min((current / goal) * 100, 100);

  return (
    <div className="progress-thermometer">
      <div className="progress-stats">
        <span className="progress-current">¥{current.toLocaleString()}</span>
        <span className="progress-separator">/</span>
        <span className="progress-goal">¥{goal.toLocaleString()} 目標</span>
        {donorCount !== undefined && (
          <span className="progress-donors">👥 {donorCount}人が支援</span>
        )}
      </div>
      <div
        className="progress-bar-container"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${percentage.toFixed(0)}%達成`}
      >
        <div
          className="progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="progress-percentage">{percentage.toFixed(0)}%</div>
    </div>
  );
}

// Amount Button Component
function AmountButton({
  amount,
  selected,
  onClick,
  isPopular,
  impact,
  period,
}: {
  amount: number;
  selected: boolean;
  onClick: () => void;
  isPopular?: boolean;
  impact?: { icon: string; message: string };
  period?: string;
}) {
  return (
    <button
      className={`amount-button ${selected ? "selected" : ""}`}
      onClick={onClick}
      type="button"
      aria-pressed={selected}
    >
      <div className="amount-button-header">
        <span className="amount-value">¥{amount.toLocaleString()}</span>
        {period && <span className="amount-period">/{period}</span>}
        {isPopular && <span className="amount-popular">★ 人気</span>}
      </div>
      {impact && (
        <div className="amount-impact">
          <span className="impact-icon">{impact.icon}</span>
          <span className="impact-message">{impact.message}</span>
        </div>
      )}
    </button>
  );
}

// Fee Transparency Component
function FeeTransparency({
  amount,
  coverFee,
  onCoverFeeChange,
}: {
  amount: number;
  coverFee: boolean;
  onCoverFeeChange: (cover: boolean) => void;
}) {
  const fee = Math.ceil(amount * FEE_RATE);
  const netAmount = amount - fee;
  const totalWithFee = amount + fee;

  return (
    <div className="fee-transparency">
      <h4>手数料の内訳</h4>
      <div className="fee-breakdown">
        <div className="fee-row">
          <span>寄付金額</span>
          <span>¥{amount.toLocaleString()}</span>
        </div>
        <div className="fee-row">
          <span>決済手数料(3.6%)</span>
          <span>- ¥{fee.toLocaleString()}</span>
        </div>
        <div className="fee-row fee-net">
          <span>実際に届く金額</span>
          <span>¥{netAmount.toLocaleString()}</span>
        </div>
      </div>
      <label className="fee-cover-option">
        <input
          type="checkbox"
          checked={coverFee}
          onChange={(e) => onCoverFeeChange(e.target.checked)}
        />
        <span className="fee-cover-label">
          手数料も負担する（+¥{fee.toLocaleString()}）
        </span>
        {coverFee && (
          <span className="fee-cover-note">
            → ¥{amount.toLocaleString()}がそのまま届きます
          </span>
        )}
      </label>
    </div>
  );
}

// Security Badge Component
function SecurityBadge() {
  return (
    <div className="security-badge" aria-label="セキュリティ情報">
      <div className="security-items">
        <span className="security-item">🔒 SSL暗号化</span>
        <span className="security-separator">│</span>
        <span className="security-item">💳 Stripe</span>
        <span className="security-separator">│</span>
        <span className="security-item">✅ PCI DSS準拠</span>
      </div>
      <p className="security-note">カード情報は当サイトには保存されません</p>
    </div>
  );
}

// Inline Validation Input Component
function ValidatedInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  placeholder,
  required,
  validation,
  rows,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur: () => void;
  placeholder?: string;
  required?: boolean;
  validation: { touched: boolean; valid: boolean; message?: string };
  rows?: number;
}) {
  const showError = validation.touched && !validation.valid;
  const showSuccess = validation.touched && validation.valid && value;
  const InputComponent = rows ? "textarea" : "input";

  return (
    <div className="form-group">
      <label htmlFor={id}>
        {label}
        {required && <span className="required" aria-label="必須">*</span>}
      </label>
      <div className={`input-wrapper ${showError ? "error" : ""} ${showSuccess ? "success" : ""}`}>
        <InputComponent
          id={id}
          type={type}
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            onChange(e.target.value)
          }
          onBlur={onBlur}
          placeholder={placeholder}
          aria-required={required}
          aria-invalid={showError}
          aria-describedby={showError ? `${id}-error` : undefined}
          rows={rows}
        />
        <span className="validation-icon">
          {showSuccess && "✅"}
          {showError && "❌"}
        </span>
      </div>
      {showError && validation.message && (
        <span id={`${id}-error`} className="error-message" role="alert">
          ❌ {validation.message}
        </span>
      )}
    </div>
  );
}

// Payment Method Button Component
function PaymentMethodButton({
  method,
  amount,
  onClick,
  disabled,
  primary,
}: {
  method: PaymentMethod;
  amount: number;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const config: Record<PaymentMethod, { icon: string; label: string }> = {
    apple_pay: { icon: "", label: "Apple Pay" },
    google_pay: { icon: "", label: "Google Pay" },
    card: { icon: "💳", label: "クレジットカード" },
    paypay: { icon: "📱", label: "PayPay" },
    bank_transfer: { icon: "🏦", label: "銀行振込" },
  };

  const { icon, label } = config[method];

  return (
    <button
      className={`payment-button ${primary ? "primary" : ""}`}
      onClick={onClick}
      disabled={disabled}
      type="button"
    >
      {icon && <span className="payment-icon">{icon}</span>}
      <span className="payment-label">
        {primary
          ? `${label} で ¥${amount.toLocaleString()} を寄付`
          : `${label}で寄付`}
      </span>
    </button>
  );
}

// Main Donation Form Component
function DonationForm() {
  const [step, setStep] = useState<Step>("amount");
  const [donationType, setDonationType] = useState<DonationType>("one-time");
  const [amount, setAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [coverFee, setCoverFee] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [event, setEvent] = useState<DonationEvent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<ValidationState>({
    email: { touched: false, valid: false },
    name: { touched: false, valid: true },
    message: { touched: false, valid: true },
    amount: { valid: true },
  });

  const presetAmounts = useMemo(() => {
    if (event?.priceOptions) return event.priceOptions;
    return donationType === "monthly" ? [500, 1000, 3000, 5000] : [500, 1000, 3000, 5000, 10000];
  }, [donationType, event]);

  // Load event data if in event context
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/\/donate\/([^/]+)/);
    if (match && match[1] !== "complete" && match[1] !== "cancel") {
      loadEvent(match[1]);
    }
  }, []);

  const loadEvent = async (eventId: string) => {
    try {
      const data = await api<{ data: DonationEvent }>(`/api/events/${eventId}`);
      setEvent(data.data);
    } catch (err) {
      console.error("Failed to load event:", err);
    }
  };

  // Validation handlers
  const handleEmailChange = useCallback((value: string) => {
    setEmail(value);
    if (validation.email.touched) {
      setValidation((v) => ({
        ...v,
        email: { ...v.email, ...validateEmail(value) },
      }));
    }
  }, [validation.email.touched]);

  const handleEmailBlur = useCallback(() => {
    setValidation((v) => ({
      ...v,
      email: { touched: true, ...validateEmail(email) },
    }));
  }, [email]);

  const handleNameChange = useCallback((value: string) => {
    setName(value);
    if (validation.name.touched) {
      setValidation((v) => ({
        ...v,
        name: { ...v.name, ...validateName(value) },
      }));
    }
  }, [validation.name.touched]);

  const handleNameBlur = useCallback(() => {
    setValidation((v) => ({
      ...v,
      name: { touched: true, ...validateName(name) },
    }));
  }, [name]);

  const handleMessageChange = useCallback((value: string) => {
    setMessage(value);
    if (validation.message.touched) {
      setValidation((v) => ({
        ...v,
        message: { ...v.message, ...validateMessage(value) },
      }));
    }
  }, [validation.message.touched]);

  const handleMessageBlur = useCallback(() => {
    setValidation((v) => ({
      ...v,
      message: { touched: true, ...validateMessage(message) },
    }));
  }, [message]);

  const handleAmountSelect = (value: number) => {
    setAmount(value);
    setCustomAmount("");
    setValidation((v) => ({
      ...v,
      amount: validateAmount(value),
    }));
  };

  const handleCustomAmountChange = (value: string) => {
    setCustomAmount(value);
    const numValue = parseInt(value, 10) || 0;
    setAmount(numValue);
    setValidation((v) => ({
      ...v,
      amount: validateAmount(numValue),
    }));
  };

  // Calculate final amount
  const finalAmount = useMemo(() => {
    if (coverFee) {
      return amount + Math.ceil(amount * FEE_RATE);
    }
    return amount;
  }, [amount, coverFee]);

  // Form submission
  const handleSubmit = async (paymentMethod: PaymentMethod) => {
    // Validate all fields
    const emailValidation = validateEmail(email);
    const nameValidation = validateName(name);
    const messageValidation = validateMessage(message);
    const amountValidation = validateAmount(amount);

    setValidation({
      email: { touched: true, ...emailValidation },
      name: { touched: true, ...nameValidation },
      message: { touched: true, ...messageValidation },
      amount: amountValidation,
    });

    if (!emailValidation.valid || !amountValidation.valid) {
      setError("入力内容を確認してください");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const endpoint = donationType === "one-time" || event
        ? "/api/donations"
        : "/api/subscriptions";

      const body: Record<string, unknown> = {
        type: event ? "event" : donationType,
        amount: finalAmount,
        paymentMethod: paymentMethod === "apple_pay" || paymentMethod === "google_pay" ? "card" : paymentMethod,
        donor: { email, name: name || undefined },
        message: message || undefined,
        coverFee,
      };

      if (event) {
        body.eventId = event.id;
      }

      const data = await api<{ stripeSessionUrl: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      // Redirect to Stripe Checkout
      window.location.href = data.stripeSessionUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setLoading(false);
    }
  };

  // Step 1: Amount Selection
  const renderAmountStep = () => (
    <div className="step">
      {event && (
        <div className="event-header">
          <h2>🎉 {event.name}</h2>
          {event.description && <p>{event.description}</p>}
          {event.goalAmount && event.currentAmount !== undefined && (
            <ProgressThermometer
              current={event.currentAmount}
              goal={event.goalAmount}
              donorCount={event.donorCount}
            />
          )}
        </div>
      )}

      <h3>寄付金額を選択</h3>

      {!event && (
        <div className="donation-type-toggle">
          <button
            className={`toggle-option ${donationType === "one-time" ? "active" : ""}`}
            onClick={() => setDonationType("one-time")}
            type="button"
          >
            単発寄付
          </button>
          <button
            className={`toggle-option ${donationType === "monthly" ? "active" : ""}`}
            onClick={() => setDonationType("monthly")}
            type="button"
          >
            月額サポート
          </button>
        </div>
      )}

      <div className="amount-grid">
        {presetAmounts.map((a, index) => (
          <AmountButton
            key={a}
            amount={a}
            selected={amount === a && !customAmount}
            onClick={() => handleAmountSelect(a)}
            isPopular={a === 1000}
            impact={event?.impactMessages?.[a]
              ? { icon: "🎯", message: event.impactMessages[a] }
              : IMPACT_MESSAGES[a]}
            period={donationType === "monthly" ? "月" : undefined}
          />
        ))}
      </div>

      <div className="custom-amount">
        <label htmlFor="custom-amount">その他の金額</label>
        <div className={`input-with-prefix ${!validation.amount.valid ? "error" : ""}`}>
          <span>¥</span>
          <input
            id="custom-amount"
            type="number"
            value={customAmount}
            onChange={(e) => handleCustomAmountChange(e.target.value)}
            placeholder="金額を入力"
            min={MIN_AMOUNT}
            max={MAX_AMOUNT}
            aria-describedby={!validation.amount.valid ? "amount-error" : undefined}
          />
          <span className="period-suffix">円</span>
        </div>
        {!validation.amount.valid && validation.amount.message && (
          <span id="amount-error" className="error-message" role="alert">
            ❌ {validation.amount.message}
          </span>
        )}
      </div>

      <FeeTransparency
        amount={amount}
        coverFee={coverFee}
        onCoverFeeChange={setCoverFee}
      />

      <button
        className="btn-primary"
        onClick={() => setStep("info")}
        disabled={!validation.amount.valid}
        type="button"
      >
        次へ進む →
      </button>
    </div>
  );

  // Step 2: Info & Payment
  const renderInfoStep = () => (
    <div className="step">
      <ValidatedInput
        id="name"
        label="お名前（任意）"
        value={name}
        onChange={handleNameChange}
        onBlur={handleNameBlur}
        placeholder="匿名の場合は空欄"
        validation={validation.name}
      />

      <ValidatedInput
        id="email"
        label="メールアドレス"
        type="email"
        value={email}
        onChange={handleEmailChange}
        onBlur={handleEmailBlur}
        placeholder="your@email.com"
        required
        validation={validation.email}
      />

      <ValidatedInput
        id="message"
        label="メッセージ（任意）"
        value={message}
        onChange={handleMessageChange}
        onBlur={handleMessageBlur}
        placeholder="応援メッセージをどうぞ"
        validation={validation.message}
        rows={3}
      />

      <div className="payment-section">
        <h3>お支払い方法</h3>

        <div className="payment-wallet-buttons">
          <PaymentMethodButton
            method="apple_pay"
            amount={finalAmount}
            onClick={() => handleSubmit("apple_pay")}
            disabled={loading}
            primary
          />
          <PaymentMethodButton
            method="google_pay"
            amount={finalAmount}
            onClick={() => handleSubmit("google_pay")}
            disabled={loading}
            primary
          />
        </div>

        <div className="payment-divider">
          <span>または</span>
        </div>

        <div className="payment-other-buttons">
          <PaymentMethodButton
            method="card"
            amount={finalAmount}
            onClick={() => handleSubmit("card")}
            disabled={loading}
          />
          <PaymentMethodButton
            method="paypay"
            amount={finalAmount}
            onClick={() => handleSubmit("paypay")}
            disabled={loading}
          />
          <PaymentMethodButton
            method="bank_transfer"
            amount={finalAmount}
            onClick={() => handleSubmit("bank_transfer")}
            disabled={loading}
          />
        </div>
      </div>

      <SecurityBadge />

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button
        className="btn-back"
        onClick={() => setStep("amount")}
        disabled={loading}
        type="button"
      >
        ← 戻る
      </button>
    </div>
  );

  return (
    <div className="donation-container">
      <header className="donation-header">
        <h1>{event ? event.name : "💝 ご寄付のお願い"}</h1>
        {!event && <p>皆様のご支援が活動の力になります</p>}
      </header>

      <StepProgress currentStep={step} />

      <div className="donation-form">
        {step === "amount" && renderAmountStep()}
        {step === "info" && renderInfoStep()}
      </div>

      <footer className="donation-footer">
        <a href="/legal">特定商取引法に基づく表記</a>
        <span>│</span>
        <a href="/privacy">プライバシーポリシー</a>
      </footer>
    </div>
  );
}

// Complete Page with Impact Message
function CompletePage() {
  const params = new URLSearchParams(window.location.search);
  const amount = parseInt(params.get("amount") || "0", 10);
  const eventName = params.get("event") || "";

  // Determine impact message based on amount
  const getImpactMessage = (amount: number) => {
    if (amount >= 10000) return { icon: "💪", message: "1ヶ月分の総合支援を届けることができます" };
    if (amount >= 5000) return { icon: "🏠", message: "1週間分の生活支援を届けることができます" };
    if (amount >= 3000) return { icon: "🎒", message: "1ヶ月分の教育支援を届けることができます" };
    if (amount >= 1000) return { icon: "📚", message: "子ども1人に学用品1セットを届けることができます" };
    return { icon: "🍙", message: "子ども1人に1日分の食事を届けることができます" };
  };

  const impact = getImpactMessage(amount);

  return (
    <div className="donation-container">
      <div className="step-progress" role="navigation" aria-label="フォームの進捗">
        <div className="step-progress-bar">
          <div className="step-indicator completed">
            <span className="step-num">✓</span>
            <span className="step-label">金額選択</span>
          </div>
          <div className="step-connector completed" />
          <div className="step-indicator completed">
            <span className="step-num">✓</span>
            <span className="step-label">情報入力</span>
          </div>
          <div className="step-connector completed" />
          <div className="step-indicator active">
            <span className="step-num">③</span>
            <span className="step-label">完了</span>
          </div>
        </div>
      </div>

      <div className="complete-container">
        <div className="complete-sparkle">✨</div>
        <h1>ありがとうございます！</h1>
        {amount > 0 && (
          <p className="complete-amount">
            ¥{amount.toLocaleString()} を{eventName || "活動"}に寄付しました
          </p>
        )}

        <div className="impact-card">
          <p className="impact-title">🎯 この寄付で</p>
          <p className="impact-detail">{impact.message}</p>
        </div>

        <div className="complete-email-note">
          <span className="email-icon">📧</span>
          <span>確認メールを送信しました</span>
        </div>

        <div className="complete-actions">
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
              `${eventName || "活動"}に寄付しました！ #寄付`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-share"
          >
            🐦 Xでシェア
          </a>
          <a href="/" className="btn-primary">
            ホームに戻る
          </a>
        </div>
      </div>
    </div>
  );
}

// Cancel Page
function CancelPage() {
  return (
    <div className="donation-container">
      <div className="complete-container cancel">
        <div className="complete-icon">❌</div>
        <h1>キャンセルされました</h1>
        <p>寄付手続きがキャンセルされました。</p>
        <a href="/" className="btn-primary">
          もう一度試す
        </a>
      </div>
    </div>
  );
}

// Router
function App() {
  const path = window.location.pathname;

  if (path === "/donate/complete") {
    return <CompletePage />;
  }

  if (path === "/donate/cancel") {
    return <CancelPage />;
  }

  return <DonationForm />;
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
