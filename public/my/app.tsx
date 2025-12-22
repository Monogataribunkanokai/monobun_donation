import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

// Types
interface Subscription {
  id: string;
  amount: number;
  interval: "monthly" | "yearly";
  status: "active" | "paused" | "cancelled";
  pausedUntil?: string;
  nextBillingDate: string;
  createdAt: string;
  eventName?: string;
}

interface Donation {
  id: string;
  amount: number;
  createdAt: string;
  eventName?: string;
  receiptUrl?: string;
}

interface UserData {
  email: string;
  name?: string;
  subscriptions: Subscription[];
  donations: Donation[];
}

// API helper
async function api<T>(path: string, token: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...((options.headers as Record<string, string>) || {}),
    },
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "API error");
  }

  return data;
}

// Modal Component
function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// Subscription Card Component
function SubscriptionCard({
  subscription,
  onPause,
  onResume,
  onCancel,
  onChangeAmount,
}: {
  subscription: Subscription;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onChangeAmount: () => void;
}) {
  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active":
        return { label: "有効", className: "status-active" };
      case "paused":
        return { label: "一時停止中", className: "status-paused" };
      case "cancelled":
        return { label: "キャンセル済み", className: "status-cancelled" };
      default:
        return { label: status, className: "" };
    }
  };

  const statusInfo = getStatusLabel(subscription.status);

  return (
    <div className="subscription-card">
      <div className="subscription-header">
        <div className="subscription-amount">
          ¥{subscription.amount.toLocaleString()}
          <span className="subscription-interval">
            /{subscription.interval === "monthly" ? "月" : "年"}
          </span>
        </div>
        <span className={`subscription-status ${statusInfo.className}`}>
          {statusInfo.label}
        </span>
      </div>

      {subscription.eventName && (
        <p className="subscription-event">{subscription.eventName}</p>
      )}

      <div className="subscription-details">
        <div className="detail-row">
          <span>次回請求日</span>
          <span>{new Date(subscription.nextBillingDate).toLocaleDateString("ja-JP")}</span>
        </div>
        <div className="detail-row">
          <span>開始日</span>
          <span>{new Date(subscription.createdAt).toLocaleDateString("ja-JP")}</span>
        </div>
        {subscription.pausedUntil && (
          <div className="detail-row">
            <span>再開予定日</span>
            <span>{new Date(subscription.pausedUntil).toLocaleDateString("ja-JP")}</span>
          </div>
        )}
      </div>

      {subscription.status !== "cancelled" && (
        <div className="subscription-actions">
          <button
            className="btn-secondary"
            onClick={onChangeAmount}
            disabled={subscription.status === "paused"}
          >
            金額変更
          </button>
          {subscription.status === "active" ? (
            <button className="btn-secondary" onClick={onPause}>
              一時停止
            </button>
          ) : subscription.status === "paused" ? (
            <button className="btn-secondary" onClick={onResume}>
              再開する
            </button>
          ) : null}
          <button className="btn-danger" onClick={onCancel}>
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
}

// Donation History Table
function DonationHistory({
  donations,
  onDownload,
}: {
  donations: Donation[];
  onDownload: () => void;
}) {
  if (donations.length === 0) {
    return (
      <div className="empty-state">
        <p>寄付履歴がありません</p>
      </div>
    );
  }

  return (
    <div className="donation-history">
      <div className="history-header">
        <h3>寄付履歴</h3>
        <button className="btn-download" onClick={onDownload}>
          CSV ダウンロード（確定申告用）
        </button>
      </div>

      <div className="donation-table-wrapper">
        <table className="donation-table">
          <thead>
            <tr>
              <th>日付</th>
              <th>金額</th>
              <th>イベント</th>
              <th>領収書</th>
            </tr>
          </thead>
          <tbody>
            {donations.map((donation) => (
              <tr key={donation.id}>
                <td>{new Date(donation.createdAt).toLocaleDateString("ja-JP")}</td>
                <td>¥{donation.amount.toLocaleString()}</td>
                <td>{donation.eventName || "-"}</td>
                <td>
                  {donation.receiptUrl ? (
                    <a
                      href={donation.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="receipt-link"
                    >
                      表示
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="history-total">
        合計: ¥{donations.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
        （{donations.length}件）
      </p>
    </div>
  );
}

// Main Self-Service Portal Component
function SelfServicePortal() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userData, setUserData] = useState<UserData | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modal states
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [amountModalOpen, setAmountModalOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [pauseDuration, setPauseDuration] = useState<1 | 2 | 3>(1);
  const [newAmount, setNewAmount] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get("token");

    if (!tokenParam) {
      setError("アクセストークンが必要です。メールのリンクからアクセスしてください。");
      setLoading(false);
      return;
    }

    setToken(tokenParam);
    loadUserData(tokenParam);
  }, []);

  const loadUserData = async (tokenValue: string) => {
    try {
      setLoading(true);
      const data = await api<{ data: UserData }>("/api/my/subscriptions", tokenValue);
      setUserData(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "データの読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    if (!token || !selectedSubscription) return;

    setActionLoading(true);
    try {
      await api(`/api/my/subscriptions/${selectedSubscription.id}/pause`, token, {
        method: "POST",
        body: JSON.stringify({ months: pauseDuration }),
      });
      await loadUserData(token);
      setPauseModalOpen(false);
      setSelectedSubscription(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "一時停止に失敗しました");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async (subscription: Subscription) => {
    if (!token) return;

    setActionLoading(true);
    try {
      await api(`/api/my/subscriptions/${subscription.id}/resume`, token, {
        method: "POST",
      });
      await loadUserData(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "再開に失敗しました");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!token || !selectedSubscription) return;

    setActionLoading(true);
    try {
      await api(`/api/my/subscriptions/${selectedSubscription.id}/cancel`, token, {
        method: "POST",
      });
      await loadUserData(token);
      setCancelModalOpen(false);
      setSelectedSubscription(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "キャンセルに失敗しました");
    } finally {
      setActionLoading(false);
    }
  };

  const handleChangeAmount = async () => {
    if (!token || !selectedSubscription || newAmount < 100) return;

    setActionLoading(true);
    try {
      await api(`/api/my/subscriptions/${selectedSubscription.id}/amount`, token, {
        method: "PUT",
        body: JSON.stringify({ amount: newAmount }),
      });
      await loadUserData(token);
      setAmountModalOpen(false);
      setSelectedSubscription(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "金額変更に失敗しました");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadHistory = () => {
    if (!userData) return;

    const headers = ["日付", "金額", "イベント", "ID"];
    const rows = userData.donations.map((d) => [
      new Date(d.createdAt).toLocaleDateString("ja-JP"),
      d.amount.toString(),
      d.eventName || "",
      d.id,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `donation-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Loading state
  if (loading) {
    return (
      <div className="portal-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !userData) {
    return (
      <div className="portal-container">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h2>エラー</h2>
          <p>{error}</p>
          <a href="/" className="btn-primary">
            トップへ戻る
          </a>
        </div>
      </div>
    );
  }

  if (!userData) return null;

  return (
    <div className="portal-container">
      <header className="portal-header">
        <h1>マイページ</h1>
        <p className="user-email">{userData.email}</p>
      </header>

      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="閉じる">
            ×
          </button>
        </div>
      )}

      <section className="subscriptions-section">
        <h2>サブスクリプション</h2>
        {userData.subscriptions.length === 0 ? (
          <div className="empty-state">
            <p>現在有効なサブスクリプションはありません</p>
            <a href="/donate" className="btn-primary">
              寄付する
            </a>
          </div>
        ) : (
          <div className="subscriptions-grid">
            {userData.subscriptions.map((subscription) => (
              <SubscriptionCard
                key={subscription.id}
                subscription={subscription}
                onPause={() => {
                  setSelectedSubscription(subscription);
                  setPauseModalOpen(true);
                }}
                onResume={() => handleResume(subscription)}
                onCancel={() => {
                  setSelectedSubscription(subscription);
                  setCancelModalOpen(true);
                }}
                onChangeAmount={() => {
                  setSelectedSubscription(subscription);
                  setNewAmount(subscription.amount);
                  setAmountModalOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="history-section">
        <DonationHistory
          donations={userData.donations}
          onDownload={handleDownloadHistory}
        />
      </section>

      {/* Pause Modal */}
      <Modal
        isOpen={pauseModalOpen}
        onClose={() => setPauseModalOpen(false)}
        title="サブスクリプションを一時停止"
      >
        <p>一時停止期間を選択してください（最大3ヶ月）</p>
        <div className="pause-options">
          {([1, 2, 3] as const).map((months) => (
            <button
              key={months}
              className={`pause-option ${pauseDuration === months ? "selected" : ""}`}
              onClick={() => setPauseDuration(months)}
            >
              {months}ヶ月
            </button>
          ))}
        </div>
        <p className="modal-note">
          一時停止中は請求されません。期間終了後、自動的に再開されます。
        </p>
        <div className="modal-actions">
          <button
            className="btn-secondary"
            onClick={() => setPauseModalOpen(false)}
            disabled={actionLoading}
          >
            キャンセル
          </button>
          <button
            className="btn-primary"
            onClick={handlePause}
            disabled={actionLoading}
          >
            {actionLoading ? "処理中..." : "一時停止する"}
          </button>
        </div>
      </Modal>

      {/* Cancel Modal */}
      <Modal
        isOpen={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        title="サブスクリプションをキャンセル"
      >
        <div className="cancel-warning">
          <p>本当にキャンセルしますか？</p>
          <p>この操作は取り消すことができません。</p>
        </div>
        <div className="modal-actions">
          <button
            className="btn-secondary"
            onClick={() => setCancelModalOpen(false)}
            disabled={actionLoading}
          >
            戻る
          </button>
          <button
            className="btn-danger"
            onClick={handleCancel}
            disabled={actionLoading}
          >
            {actionLoading ? "処理中..." : "キャンセルする"}
          </button>
        </div>
      </Modal>

      {/* Amount Change Modal */}
      <Modal
        isOpen={amountModalOpen}
        onClose={() => setAmountModalOpen(false)}
        title="金額を変更"
      >
        <div className="amount-change-form">
          <label htmlFor="new-amount">新しい金額</label>
          <div className="amount-input-wrapper">
            <span>¥</span>
            <input
              id="new-amount"
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(parseInt(e.target.value, 10) || 0)}
              min={100}
              max={10000000}
            />
            <span>/月</span>
          </div>
          <p className="amount-hint">最低金額: ¥100</p>
        </div>
        <div className="modal-actions">
          <button
            className="btn-secondary"
            onClick={() => setAmountModalOpen(false)}
            disabled={actionLoading}
          >
            キャンセル
          </button>
          <button
            className="btn-primary"
            onClick={handleChangeAmount}
            disabled={actionLoading || newAmount < 100}
          >
            {actionLoading ? "処理中..." : "変更する"}
          </button>
        </div>
      </Modal>

      <footer className="portal-footer">
        <a href="/donate">新しく寄付する</a>
        <span>│</span>
        <a href="/legal">特定商取引法に基づく表記</a>
        <span>│</span>
        <a href="/privacy">プライバシーポリシー</a>
      </footer>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<SelfServicePortal />);
