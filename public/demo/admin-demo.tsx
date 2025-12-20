import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

// Mock Data
const mockDonations = [
  { id: "don_abc123", donor_name: "田中太郎", donor_email: "tanaka@example.com", amount: 10000, type: "one-time", status: "completed", created_at: "2024-12-19T10:30:00Z" },
  { id: "don_def456", donor_name: "佐藤花子", donor_email: "sato@example.com", amount: 5000, type: "event", status: "completed", created_at: "2024-12-18T14:20:00Z" },
  { id: "don_ghi789", donor_name: "匿名", donor_email: "anon@example.com", amount: 3000, type: "one-time", status: "completed", created_at: "2024-12-17T09:15:00Z" },
  { id: "don_jkl012", donor_name: "山田一郎", donor_email: "yamada@example.com", amount: 30000, type: "event", status: "completed", created_at: "2024-12-16T16:45:00Z" },
  { id: "don_mno345", donor_name: "鈴木美咲", donor_email: "suzuki@example.com", amount: 1000, type: "one-time", status: "refunded", created_at: "2024-12-15T11:00:00Z" },
  { id: "don_pqr678", donor_name: "高橋健", donor_email: "takahashi@example.com", amount: 50000, type: "one-time", status: "completed", created_at: "2024-12-14T08:30:00Z" },
  { id: "don_stu901", donor_name: "伊藤さくら", donor_email: "ito@example.com", amount: 2000, type: "event", status: "completed", created_at: "2024-12-13T13:20:00Z" },
];

const mockSubscriptions = [
  { id: "sub_abc123", donor_name: "田中太郎", donor_email: "tanaka@example.com", amount: 1000, type: "monthly", status: "active", created_at: "2024-10-01T10:00:00Z" },
  { id: "sub_def456", donor_name: "佐藤花子", donor_email: "sato@example.com", amount: 3000, type: "monthly", status: "active", created_at: "2024-09-15T14:00:00Z" },
  { id: "sub_ghi789", donor_name: "山田一郎", donor_email: "yamada@example.com", amount: 12000, type: "yearly", status: "active", created_at: "2024-01-01T00:00:00Z" },
  { id: "sub_jkl012", donor_name: "高橋健", donor_email: "takahashi@example.com", amount: 5000, type: "monthly", status: "cancelled", created_at: "2024-06-01T09:00:00Z" },
  { id: "sub_mno345", donor_name: "渡辺優子", donor_email: "watanabe@example.com", amount: 500, type: "monthly", status: "active", created_at: "2024-11-20T15:30:00Z" },
];

const mockEvents = [
  { id: "evt_abc123", name: "年末募金キャンペーン", description: "年末の支援活動のための募金", goal_amount: 1000000, current_amount: 450000, status: "active", created_at: "2024-12-01T00:00:00Z" },
  { id: "evt_def456", name: "災害支援基金", description: "被災地への緊急支援", goal_amount: 500000, current_amount: 520000, status: "active", created_at: "2024-11-15T00:00:00Z" },
  { id: "evt_ghi789", name: "子ども教育支援", description: "恵まれない子どもたちへの教育支援", goal_amount: 2000000, current_amount: 780000, status: "active", created_at: "2024-10-01T00:00:00Z" },
  { id: "evt_jkl012", name: "夏の募金イベント", description: "夏季の支援活動", goal_amount: 300000, current_amount: 300000, status: "ended", created_at: "2024-07-01T00:00:00Z" },
];

const mockStats = {
  totals: {
    total_count: 156,
    total_amount: 2450000,
    completed_amount: 2380000,
    completed_count: 148,
  }
};

const mockUser = {
  id: "admin_demo",
  email: "admin@example.com",
  role: "super_admin",
};

// Types
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
  current_amount?: number;
  status: string;
  created_at: string;
}

// Dashboard Component
function Dashboard() {
  const [activeTab, setActiveTab] = useState<"donations" | "subscriptions" | "events" | "settings">("donations");

  const handleLogout = () => {
    alert("デモ画面のためログアウトできません");
  };

  return (
    <div className="dashboard">
      <header className="header">
        <h1>Donation Admin (Demo)</h1>
        <div className="user-info">
          <span>{mockUser.email}</span>
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

      <div className="stats-summary">
        <div className="stat-card">
          <h3>総寄付額</h3>
          <p className="stat-value">{mockStats.totals.completed_amount.toLocaleString()}</p>
        </div>
        <div className="stat-card">
          <h3>完了件数</h3>
          <p className="stat-value">{mockStats.totals.completed_count}</p>
        </div>
        <div className="stat-card">
          <h3>総件数</h3>
          <p className="stat-value">{mockStats.totals.total_count}</p>
        </div>
      </div>

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
  const handleRefund = (donationId: string) => {
    alert(`デモ: 寄付 ${donationId} の返金処理をシミュレートしました`);
  };

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
          {mockDonations.map((d) => (
            <tr key={d.id}>
              <td>{d.id}</td>
              <td>{d.donor_name}<br /><small>{d.donor_email}</small></td>
              <td>{d.amount.toLocaleString()}</td>
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
        <button disabled>前へ</button>
        <span>ページ 1 / 1</span>
        <button disabled>次へ</button>
      </div>
    </div>
  );
}

// Subscriptions List
function SubscriptionsList() {
  const handleCancel = (subscriptionId: string) => {
    alert(`デモ: 定期支援 ${subscriptionId} のキャンセルをシミュレートしました`);
  };

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
          {mockSubscriptions.map((s) => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.donor_name}<br /><small>{s.donor_email}</small></td>
              <td>{s.amount.toLocaleString()}/{s.type === "monthly" ? "月" : "年"}</td>
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
        <button disabled>前へ</button>
        <span>ページ 1 / 1</span>
        <button disabled>次へ</button>
      </div>
    </div>
  );
}

// Events List
function EventsList() {
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<DonationEvent | null>(null);

  const handleDelete = (eventId: string) => {
    alert(`デモ: イベント ${eventId} の削除をシミュレートしました`);
  };

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
          onSave={() => { setShowForm(false); alert("デモ: イベントの保存をシミュレートしました"); }}
        />
      )}

      <table>
        <thead>
          <tr>
            <th>名前</th>
            <th>目標金額</th>
            <th>現在の金額</th>
            <th>進捗</th>
            <th>ステータス</th>
            <th>作成日</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {mockEvents.map((e) => (
            <tr key={e.id}>
              <td>{e.name}</td>
              <td>{e.goal_amount ? `${e.goal_amount.toLocaleString()}` : "-"}</td>
              <td>{e.current_amount ? `${e.current_amount.toLocaleString()}` : "-"}</td>
              <td>
                {e.goal_amount && e.current_amount && (
                  <div className="progress-bar-mini">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(100, (e.current_amount / e.goal_amount) * 100)}%` }}
                    />
                    <span>{Math.round((e.current_amount / e.goal_amount) * 100)}%</span>
                  </div>
                )}
              </td>
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave();
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
            <button type="submit">保存</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Settings Panel
function SettingsPanel() {
  const [settings, setSettings] = useState({
    site_name: "Donation Site",
    site_description: "皆様のご支援が活動の力になります",
    min_donation_amount: 100,
    enable_anonymous_donations: true,
    maintenance_mode: false,
  });

  const handleSave = () => {
    alert("デモ: 設定の保存をシミュレートしました");
  };

  return (
    <div className="settings-panel">
      <h2>設定</h2>
      <div className="form-group">
        <label>サイト名</label>
        <input
          type="text"
          value={settings.site_name}
          onChange={(e) => setSettings({ ...settings, site_name: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>サイト説明</label>
        <textarea
          value={settings.site_description}
          onChange={(e) => setSettings({ ...settings, site_description: e.target.value })}
        />
      </div>
      <div className="form-group">
        <label>最小寄付額</label>
        <input
          type="number"
          value={settings.min_donation_amount}
          onChange={(e) => setSettings({ ...settings, min_donation_amount: parseInt(e.target.value, 10) })}
        />
      </div>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={settings.enable_anonymous_donations}
            onChange={(e) => setSettings({ ...settings, enable_anonymous_donations: e.target.checked })}
          />
          匿名寄付を許可
        </label>
      </div>
      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={settings.maintenance_mode}
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
  return <Dashboard />;
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
