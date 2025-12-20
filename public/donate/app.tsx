import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

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

// Types
interface DonationEvent {
  id: string;
  name: string;
  description: string;
  goalAmount: number | null;
  priceOptions: number[] | null;
}

type DonationType = "one-time" | "monthly" | "yearly";

// Donation Form
function DonationForm() {
  const [step, setStep] = useState<"type" | "amount" | "info" | "processing">("type");
  const [donationType, setDonationType] = useState<DonationType>("one-time");
  const [amount, setAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [events, setEvents] = useState<DonationEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const presetAmounts = [500, 1000, 3000, 5000, 10000];
  const monthlyAmounts = [500, 1000, 3000, 5000];

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const data = await api<{ data: DonationEvent[] }>("/api/events");
      setEvents(data.data);
    } catch (err) {
      console.error("Failed to load events:", err);
    }
  };

  const handleSubmit = async () => {
    if (!email) {
      setError("メールアドレスを入力してください");
      return;
    }

    setLoading(true);
    setError("");
    setStep("processing");

    try {
      const endpoint = donationType === "one-time" || selectedEvent
        ? "/api/donations"
        : "/api/subscriptions";

      const body: Record<string, unknown> = {
        type: selectedEvent ? "event" : donationType,
        amount,
        paymentMethod: "card",
        donor: { email, name: name || undefined },
        message: message || undefined,
      };

      if (selectedEvent) {
        body.eventId = selectedEvent;
      }

      const data = await api<{ stripeSessionUrl: string }>(endpoint, {
        method: "POST",
        body: JSON.stringify(body),
      });

      // Redirect to Stripe Checkout
      window.location.href = data.stripeSessionUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setStep("info");
      setLoading(false);
    }
  };

  const renderTypeStep = () => (
    <div className="step">
      <h2>寄付タイプを選択</h2>

      <div className="type-options">
        <button
          className={`type-option ${donationType === "one-time" ? "selected" : ""}`}
          onClick={() => { setDonationType("one-time"); setSelectedEvent(""); }}
        >
          <div className="type-icon">💝</div>
          <div className="type-label">一回限りの寄付</div>
          <div className="type-desc">今すぐサポート</div>
        </button>

        <button
          className={`type-option ${donationType === "monthly" ? "selected" : ""}`}
          onClick={() => { setDonationType("monthly"); setSelectedEvent(""); }}
        >
          <div className="type-icon">🔄</div>
          <div className="type-label">月額サポーター</div>
          <div className="type-desc">毎月の継続支援</div>
        </button>

        <button
          className={`type-option ${donationType === "yearly" ? "selected" : ""}`}
          onClick={() => { setDonationType("yearly"); setSelectedEvent(""); }}
        >
          <div className="type-icon">⭐</div>
          <div className="type-label">年額サポーター</div>
          <div className="type-desc">年間の継続支援</div>
        </button>
      </div>

      {events.length > 0 && (
        <>
          <h3>または特定のイベントを支援</h3>
          <div className="event-list">
            {events.map((event) => (
              <button
                key={event.id}
                className={`event-option ${selectedEvent === event.id ? "selected" : ""}`}
                onClick={() => { setSelectedEvent(event.id); setDonationType("one-time"); }}
              >
                <div className="event-name">{event.name}</div>
                {event.description && (
                  <div className="event-desc">{event.description}</div>
                )}
                {event.goalAmount && (
                  <div className="event-goal">目標: ¥{event.goalAmount.toLocaleString()}</div>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      <button className="btn-primary" onClick={() => setStep("amount")}>
        次へ
      </button>
    </div>
  );

  const renderAmountStep = () => {
    const amounts = donationType === "one-time" || selectedEvent
      ? presetAmounts
      : monthlyAmounts;

    return (
      <div className="step">
        <h2>金額を選択</h2>

        <div className="amount-options">
          {amounts.map((a) => (
            <button
              key={a}
              className={`amount-option ${amount === a && !customAmount ? "selected" : ""}`}
              onClick={() => { setAmount(a); setCustomAmount(""); }}
            >
              ¥{a.toLocaleString()}
              {donationType !== "one-time" && !selectedEvent && (
                <span className="period">/{donationType === "monthly" ? "月" : "年"}</span>
              )}
            </button>
          ))}
        </div>

        <div className="custom-amount">
          <label>カスタム金額</label>
          <div className="input-with-prefix">
            <span>¥</span>
            <input
              type="number"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                if (e.target.value) {
                  setAmount(parseInt(e.target.value, 10) || 0);
                }
              }}
              placeholder="金額を入力"
              min="100"
              max="10000000"
            />
          </div>
          <p className="hint">最低金額: ¥100</p>
        </div>

        <div className="step-actions">
          <button className="btn-secondary" onClick={() => setStep("type")}>
            戻る
          </button>
          <button
            className="btn-primary"
            onClick={() => setStep("info")}
            disabled={amount < 100}
          >
            次へ
          </button>
        </div>
      </div>
    );
  };

  const renderInfoStep = () => (
    <div className="step">
      <h2>お客様情報</h2>

      <div className="form-group">
        <label htmlFor="email">メールアドレス <span className="required">*</span></label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="name">お名前（任意）</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="匿名の場合は空欄"
        />
      </div>

      <div className="form-group">
        <label htmlFor="message">メッセージ（任意）</label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="応援メッセージをどうぞ"
          rows={3}
        />
      </div>

      <div className="summary">
        <h3>寄付内容</h3>
        <div className="summary-row">
          <span>タイプ</span>
          <span>
            {selectedEvent
              ? events.find((e) => e.id === selectedEvent)?.name || "イベント寄付"
              : donationType === "one-time"
                ? "一回限りの寄付"
                : donationType === "monthly"
                  ? "月額サポーター"
                  : "年額サポーター"}
          </span>
        </div>
        <div className="summary-row total">
          <span>金額</span>
          <span>¥{amount.toLocaleString()}{donationType !== "one-time" && !selectedEvent ? (donationType === "monthly" ? "/月" : "/年") : ""}</span>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <div className="step-actions">
        <button className="btn-secondary" onClick={() => setStep("amount")}>
          戻る
        </button>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading || !email}
        >
          {loading ? "処理中..." : "支払いへ進む"}
        </button>
      </div>

      <p className="security-note">
        🔒 安全なStripe決済で処理されます
      </p>
    </div>
  );

  const renderProcessingStep = () => (
    <div className="step processing">
      <div className="spinner"></div>
      <h2>処理中...</h2>
      <p>Stripeの決済ページへリダイレクトしています</p>
    </div>
  );

  return (
    <div className="donation-container">
      <header className="donation-header">
        <h1>ご支援のお願い</h1>
        <p>皆様のご支援が活動の力になります</p>
      </header>

      <div className="progress-bar">
        <div className={`progress-step ${step === "type" ? "active" : step !== "type" ? "completed" : ""}`}>
          1. タイプ
        </div>
        <div className={`progress-step ${step === "amount" ? "active" : step === "info" || step === "processing" ? "completed" : ""}`}>
          2. 金額
        </div>
        <div className={`progress-step ${step === "info" || step === "processing" ? "active" : ""}`}>
          3. 情報
        </div>
      </div>

      <div className="donation-form">
        {step === "type" && renderTypeStep()}
        {step === "amount" && renderAmountStep()}
        {step === "info" && renderInfoStep()}
        {step === "processing" && renderProcessingStep()}
      </div>
    </div>
  );
}

// Complete Page
function CompletePage() {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");

  return (
    <div className="complete-container">
      <div className="complete-icon">✅</div>
      <h1>ありがとうございます！</h1>
      <p>ご寄付の手続きが完了しました。</p>
      <p>確認メールをお送りしましたのでご確認ください。</p>
      <a href="/" className="btn-primary">トップへ戻る</a>
    </div>
  );
}

// Cancel Page
function CancelPage() {
  return (
    <div className="complete-container cancel">
      <div className="complete-icon">❌</div>
      <h1>キャンセルされました</h1>
      <p>寄付手続きがキャンセルされました。</p>
      <a href="/" className="btn-primary">もう一度試す</a>
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
