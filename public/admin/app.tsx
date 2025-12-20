import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

// API helper
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const csrfToken = localStorage.getItem("csrfToken");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...(csrfToken && { "X-CSRF-Token": csrfToken }),
    ...((options.headers as Record<string, string>) || {}),
  };

  const response = await fetch(path, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "API error");
  }

  return data;
}

// Types
interface User {
  id: string;
  email: string;
  role: string;
}

interface Donation {
  id: string;
  donor_name: string;
  donor_email: string;
  amount: number;
  type: string;
  status: string;
  created_at: string;
}

interface Subscription {
  id: string;
  donor_name: string;
  donor_email: string;
  amount: number;
  type: string;
  status: string;
  created_at: string;
}

interface DonationEvent {
  id: string;
  name: string;
  description: string;
  goal_amount: number;
  status: string;
  created_at: string;
}

interface Stats {
  totals: {
    total_count: number;
    total_amount: number;
    completed_amount: number;
    completed_count: number;
  };
}

// Login Component
function LoginForm({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState("");
  const [requireCaptcha, setRequireCaptcha] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await api<{
        token: string;
        csrfToken: string;
        user: User;
        requireCaptcha?: boolean;
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, captchaToken: captchaToken || undefined }),
      });

      if (data.requireCaptcha) {
        setRequireCaptcha(true);
        setError("CAPTCHAを完了してください");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("csrfToken", data.csrfToken);
      onLogin(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>管理画面ログイン</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">メールアドレス</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">パスワード</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {requireCaptcha && (
            <div className="form-group">
              <label htmlFor="captcha">CAPTCHA Token</label>
              <input
                id="captcha"
                type="text"
                value={captchaToken}
                onChange={(e) => setCaptchaToken(e.target.value)}
                placeholder="Turnstile CAPTCHA token"
              />
              <p className="hint">Turnstile widgetを実装してください</p>
            </div>
          )}
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={loading}>
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>
        <p className="forgot-password">
          <a href="/admin/forgot-password">パスワードを忘れた場合</a>
        </p>
      </div>
    </div>
  );
}

// Dashboard Component
function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<"donations" | "subscriptions" | "events" | "settings">("donations");
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await api<Stats>("/api/admin/donations/stats");
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("csrfToken");
      onLogout();
    }
  };

  return (
    <div className="dashboard">
      <header className="header">
        <h1>Donation Admin</h1>
        <div className="user-info">
          <span>{user.email}</span>
          <button onClick={handleLogout}>ログアウト</button>
        </div>
      </header>

      <nav className="nav">
        <button
          className={activeTab === "donations" ? "active" : ""}
          onClick={() => setActiveTab("donations")}
        >
          寄付管理
        </button>
        <button
          className={activeTab === "subscriptions" ? "active" : ""}
          onClick={() => setActiveTab("subscriptions")}
        >
          定期支援
        </button>
        <button
          className={activeTab === "events" ? "active" : ""}
          onClick={() => setActiveTab("events")}
        >
          イベント
        </button>
        <button
          className={activeTab === "settings" ? "active" : ""}
          onClick={() => setActiveTab("settings")}
        >
          設定
        </button>
      </nav>

      {stats && (
        <div className="stats-summary">
          <div className="stat-card">
            <h3>総寄付額</h3>
            <p className="stat-value">¥{stats.totals.completed_amount?.toLocaleString() || 0}</p>
          </div>
          <div className="stat-card">
            <h3>完了件数</h3>
            <p className="stat-value">{stats.totals.completed_count || 0}</p>
          </div>
          <div className="stat-card">
            <h3>総件数</h3>
            <p className="stat-value">{stats.totals.total_count || 0}</p>
          </div>
        </div>
      )}

      <main className="content">
        {activeTab === "donations" && <DonationsList />}
        {activeTab === "subscriptions" && <SubscriptionsList />}
        {activeTab === "events" && <EventsList />}
        {activeTab === "settings" && <SettingsPanel />}
      </main>
    </div>
  );
}

// Donations List
function DonationsList() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadDonations();
  }, [page]);

  const loadDonations = async () => {
    setLoading(true);
    try {
      const data = await api<{ data: Donation[]; pagination: { total: number } }>(
        `/api/admin/donations?page=${page}&limit=20`
      );
      setDonations(data.data);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error("Failed to load donations:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async (donationId: string) => {
    if (!confirm("この寄付を返金しますか？")) return;

    try {
      await api(`/api/admin/donations/${donationId}/refund`, { method: "POST" });
      alert("返金処理が完了しました");
      loadDonations();
    } catch (err) {
      alert(err instanceof Error ? err.message : "返金処理に失敗しました");
    }
  };

  if (loading) return <p>読み込み中...</p>;

  return (
    <div className="list-container">
      <h2>寄付一覧</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>寄付者</th>
            <th>金額</th>
            <th>タイプ</th>
            <th>ステータス</th>
            <th>日時</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {donations.map((d) => (
            <tr key={d.id}>
              <td>{d.id}</td>
              <td>{d.donor_name}<br /><small>{d.donor_email}</small></td>
              <td>¥{d.amount.toLocaleString()}</td>
              <td>{d.type}</td>
              <td className={`status-${d.status}`}>{d.status}</td>
              <td>{new Date(d.created_at).toLocaleString("ja-JP")}</td>
              <td>
                {d.status === "completed" && (
                  <button className="btn-small" onClick={() => handleRefund(d.id)}>
                    返金
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>前へ</button>
        <span>ページ {page} / {Math.ceil(total / 20)}</span>
        <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)}>次へ</button>
      </div>
    </div>
  );
}

// Subscriptions List
function SubscriptionsList() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadSubscriptions();
  }, [page]);

  const loadSubscriptions = async () => {
    setLoading(true);
    try {
      const data = await api<{ data: Subscription[]; pagination: { total: number } }>(
        `/api/admin/subscriptions?page=${page}&limit=20`
      );
      setSubscriptions(data.data);
      setTotal(data.pagination.total);
    } catch (err) {
      console.error("Failed to load subscriptions:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (subscriptionId: string) => {
    if (!confirm("この定期支援をキャンセルしますか？")) return;

    try {
      await api(`/api/admin/subscriptions/${subscriptionId}/cancel`, { method: "POST" });
      alert("キャンセル処理が完了しました");
      loadSubscriptions();
    } catch (err) {
      alert(err instanceof Error ? err.message : "キャンセルに失敗しました");
    }
  };

  if (loading) return <p>読み込み中...</p>;

  return (
    <div className="list-container">
      <h2>定期支援一覧</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>支援者</th>
            <th>金額</th>
            <th>タイプ</th>
            <th>ステータス</th>
            <th>開始日</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.donor_name}<br /><small>{s.donor_email}</small></td>
              <td>¥{s.amount.toLocaleString()}/{s.type === "monthly" ? "月" : "年"}</td>
              <td>{s.type === "monthly" ? "月額" : "年額"}</td>
              <td className={`status-${s.status}`}>{s.status}</td>
              <td>{new Date(s.created_at).toLocaleString("ja-JP")}</td>
              <td>
                {s.status === "active" && (
                  <button className="btn-small btn-danger" onClick={() => handleCancel(s.id)}>
                    キャンセル
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pagination">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>前へ</button>
        <span>ページ {page} / {Math.ceil(total / 20)}</span>
        <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(page + 1)}>次へ</button>
      </div>
    </div>
  );
}

// Events List
function EventsList() {
  const [events, setEvents] = useState<DonationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<DonationEvent | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await api<{ data: DonationEvent[] }>("/api/admin/events");
      setEvents(data.data);
    } catch (err) {
      console.error("Failed to load events:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm("このイベントを削除しますか？")) return;

    try {
      await api(`/api/admin/events/${eventId}`, { method: "DELETE" });
      loadEvents();
    } catch (err) {
      alert(err instanceof Error ? err.message : "削除に失敗しました");
    }
  };

  if (loading) return <p>読み込み中...</p>;

  return (
    <div className="list-container">
      <div className="list-header">
        <h2>イベント一覧</h2>
        <button onClick={() => { setEditingEvent(null); setShowForm(true); }}>
          新規作成
        </button>
      </div>

      {showForm && (
        <EventForm
          event={editingEvent}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); loadEvents(); }}
        />
      )}

      <table>
        <thead>
          <tr>
            <th>名前</th>
            <th>目標金額</th>
            <th>ステータス</th>
            <th>作成日</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{e.name}</td>
              <td>{e.goal_amount ? `¥${e.goal_amount.toLocaleString()}` : "-"}</td>
              <td className={`status-${e.status}`}>{e.status}</td>
              <td>{new Date(e.created_at).toLocaleDateString("ja-JP")}</td>
              <td>
                <button className="btn-small" onClick={() => { setEditingEvent(e); setShowForm(true); }}>
                  編集
                </button>
                <button className="btn-small btn-danger" onClick={() => handleDelete(e.id)}>
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Event Form
function EventForm({
  event,
  onClose,
  onSave,
}: {
  event: DonationEvent | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [name, setName] = useState(event?.name || "");
  const [description, setDescription] = useState(event?.description || "");
  const [goalAmount, setGoalAmount] = useState(event?.goal_amount?.toString() || "");
  const [status, setStatus] = useState(event?.status || "draft");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const body = {
        name,
        description,
        goalAmount: goalAmount ? parseInt(goalAmount, 10) : null,
        status,
      };

      if (event) {
        await api(`/api/admin/events/${event.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
      } else {
        await api("/api/admin/events", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }

      onSave();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{event ? "イベント編集" : "新規イベント"}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>名前</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label>説明</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>目標金額</label>
            <input
              type="number"
              value={goalAmount}
              onChange={(e) => setGoalAmount(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>ステータス</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="draft">下書き</option>
              <option value="active">公開中</option>
              <option value="ended">終了</option>
            </select>
          </div>
          <div className="form-actions">
            <button type="button" onClick={onClose}>キャンセル</button>
            <button type="submit" disabled={loading}>
              {loading ? "保存中..." : "保存"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Settings Panel
function SettingsPanel() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await api<{ settings: Record<string, unknown> }>("/api/admin/settings");
      setSettings(data.settings);
    } catch (err) {
      console.error("Failed to load settings:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await api("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ settings }),
      });
      alert("設定を保存しました");
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存に失敗しました");
    }
  };

  if (loading) return <p>読み込み中...</p>;

  return (
    <div className="settings-panel">
      <h2>設定</h2>
      <div className="form-group">
        <label>サイト名</label>
        <input
          type="text"
          value={(settings.site_name as string) || ""}
          onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>サイト説明</label>
        <textarea
          value={(settings.site_description as string) || ""}
          onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>最小寄付額</label>
        <input
          type="number"
          value={(settings.min_donation_amount as number) || 100}
          onChange={(e) => setSettings({ ...settings, min_donation_amount: parseInt(e.target.value, 10) })}
        />
      </div>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={(settings.enable_anonymous_donations as boolean) || false}
            onChange={(e) => setSettings({ ...settings, enable_anonymous_donations: e.target.checked })}
          />
          匿名寄付を許可
        </label>
      </div>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={(settings.maintenance_mode as boolean) || false}
            onChange={(e) => setSettings({ ...settings, maintenance_mode: e.target.checked })}
          />
          メンテナンスモード
        </label>
      </div>
      <button onClick={handleSave}>設定を保存</button>
    </div>
  );
}

// Main App
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await api<User>("/api/auth/me");
      setUser(data);
    } catch (err) {
      localStorage.removeItem("token");
      localStorage.removeItem("csrfToken");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">読み込み中...</div>;
  }

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  return <Dashboard user={user} onLogout={() => setUser(null)} />;
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
