// Monobun Donation System - Email Service

import { logger } from "./logger";

// === Configuration ===

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || "noreply@example.com";
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const SITE_NAME = process.env.SITE_NAME || "Donation Site";

// === Types ===

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// === Email Sending ===

/**
 * Send an email using Resend API
 */
export async function sendEmail(params: SendEmailParams): Promise<EmailResult> {
  if (!RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY not configured. Email not sent.", {
      to: params.to,
      subject: params.subject,
    });
    // Return success in development to allow testing without email
    return { success: true, messageId: "dev-mode" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: MAIL_FROM,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error("Failed to send email", {
        to: params.to,
        status: response.status,
        error: data.message,
      });
      return { success: false, error: data.message };
    }

    logger.info("Email sent successfully", {
      to: params.to,
      messageId: data.id,
    });

    return { success: true, messageId: data.id };
  } catch (error) {
    logger.error("Email sending error", {
      to: params.to,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// === Email Templates ===

/**
 * Password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  resetToken: string
): Promise<EmailResult> {
  const resetUrl = `${APP_URL}/admin/reset-password?token=${resetToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a;">パスワードリセット</h2>

  <p>${SITE_NAME} のパスワードリセットがリクエストされました。</p>

  <p>以下のボタンをクリックして、新しいパスワードを設定してください：</p>

  <p style="margin: 30px 0;">
    <a href="${resetUrl}"
       style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
      パスワードをリセット
    </a>
  </p>

  <p style="color: #666; font-size: 14px;">
    このリンクは1時間で有効期限が切れます。
  </p>

  <p style="color: #666; font-size: 14px;">
    このリクエストに心当たりがない場合は、このメールを無視してください。
  </p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    このメールは ${SITE_NAME} (${APP_URL}) から送信されました。<br>
    不審なアクティビティがあった場合は、管理者にご連絡ください。
  </p>
</body>
</html>
  `.trim();

  const text = `
${SITE_NAME} パスワードリセット

パスワードリセットがリクエストされました。
以下のURLにアクセスして、新しいパスワードを設定してください：

${resetUrl}

このリンクは1時間で有効期限が切れます。

このリクエストに心当たりがない場合は、このメールを無視してください。

---
${SITE_NAME} (${APP_URL})
  `.trim();

  return sendEmail({
    to: email,
    subject: `【${SITE_NAME}】パスワードリセット`,
    html,
    text,
  });
}

/**
 * Donation confirmation email
 */
export async function sendDonationConfirmationEmail(
  email: string,
  donorName: string,
  amount: number,
  donationId: string,
  eventName?: string
): Promise<EmailResult> {
  const amountFormatted = amount.toLocaleString("ja-JP");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a;">ご寄付ありがとうございます</h2>

  <p>${donorName} 様</p>

  <p>この度は ${SITE_NAME} にご寄付いただき、誠にありがとうございます。</p>

  <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0 0 10px 0;"><strong>寄付ID:</strong> ${donationId}</p>
    <p style="margin: 0 0 10px 0;"><strong>金額:</strong> ¥${amountFormatted}</p>
    ${eventName ? `<p style="margin: 0;"><strong>イベント:</strong> ${eventName}</p>` : ""}
  </div>

  <p>皆様のご支援に心より感謝申し上げます。</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    このメールは ${SITE_NAME} (${APP_URL}) から送信されました。
  </p>
</body>
</html>
  `.trim();

  const text = `
ご寄付ありがとうございます

${donorName} 様

この度は ${SITE_NAME} にご寄付いただき、誠にありがとうございます。

寄付ID: ${donationId}
金額: ¥${amountFormatted}
${eventName ? `イベント: ${eventName}` : ""}

皆様のご支援に心より感謝申し上げます。

---
${SITE_NAME} (${APP_URL})
  `.trim();

  return sendEmail({
    to: email,
    subject: `【${SITE_NAME}】ご寄付ありがとうございます`,
    html,
    text,
  });
}

/**
 * Subscription confirmation email (includes cancel link)
 */
export async function sendSubscriptionConfirmationEmail(
  email: string,
  donorName: string,
  amount: number,
  type: "monthly" | "yearly",
  subscriptionId: string,
  cancelToken: string
): Promise<EmailResult> {
  const amountFormatted = amount.toLocaleString("ja-JP");
  const typeLabel = type === "monthly" ? "月額" : "年額";
  const cancelUrl = `${APP_URL}/subscriptions/cancel?token=${cancelToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a;">定期支援のご登録ありがとうございます</h2>

  <p>${donorName} 様</p>

  <p>この度は ${SITE_NAME} の定期支援にご登録いただき、誠にありがとうございます。</p>

  <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0 0 10px 0;"><strong>サブスクリプションID:</strong> ${subscriptionId}</p>
    <p style="margin: 0 0 10px 0;"><strong>プラン:</strong> ${typeLabel}サポーター</p>
    <p style="margin: 0;"><strong>金額:</strong> ¥${amountFormatted}/${type === "monthly" ? "月" : "年"}</p>
  </div>

  <p>皆様の継続的なご支援に心より感謝申し上げます。</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #666; font-size: 14px;">
    定期支援を解約する場合は、<a href="${cancelUrl}">こちら</a>から手続きをお願いいたします。<br>
    解約は現在の請求期間の終了時に有効となります。
  </p>

  <p style="color: #999; font-size: 12px;">
    このメールは ${SITE_NAME} (${APP_URL}) から送信されました。
  </p>
</body>
</html>
  `.trim();

  const text = `
定期支援のご登録ありがとうございます

${donorName} 様

この度は ${SITE_NAME} の定期支援にご登録いただき、誠にありがとうございます。

サブスクリプションID: ${subscriptionId}
プラン: ${typeLabel}サポーター
金額: ¥${amountFormatted}/${type === "monthly" ? "月" : "年"}

皆様の継続的なご支援に心より感謝申し上げます。

---
定期支援の解約: ${cancelUrl}
解約は現在の請求期間の終了時に有効となります。

${SITE_NAME} (${APP_URL})
  `.trim();

  return sendEmail({
    to: email,
    subject: `【${SITE_NAME}】定期支援のご登録ありがとうございます`,
    html,
    text,
  });
}

/**
 * Payment failure notification
 */
export async function sendPaymentFailureEmail(
  email: string,
  donorName: string,
  subscriptionId: string
): Promise<EmailResult> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #d32f2f;">お支払いに失敗しました</h2>

  <p>${donorName} 様</p>

  <p>定期支援のお支払いに失敗しました。カード情報をご確認ください。</p>

  <div style="background-color: #fff3f3; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #d32f2f;">
    <p style="margin: 0;"><strong>サブスクリプションID:</strong> ${subscriptionId}</p>
  </div>

  <p>カード情報を更新するか、別の支払い方法をご登録ください。</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    このメールは ${SITE_NAME} (${APP_URL}) から送信されました。
  </p>
</body>
</html>
  `.trim();

  const text = `
お支払いに失敗しました

${donorName} 様

定期支援のお支払いに失敗しました。カード情報をご確認ください。

サブスクリプションID: ${subscriptionId}

カード情報を更新するか、別の支払い方法をご登録ください。

---
${SITE_NAME} (${APP_URL})
  `.trim();

  return sendEmail({
    to: email,
    subject: `【${SITE_NAME}】お支払いに失敗しました`,
    html,
    text,
  });
}

/**
 * Subscription cancelled confirmation
 */
export async function sendSubscriptionCancelledEmail(
  email: string,
  donorName: string,
  endDate: Date
): Promise<EmailResult> {
  const endDateFormatted = endDate.toLocaleDateString("ja-JP");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #1a1a1a;">定期支援の解約を受け付けました</h2>

  <p>${donorName} 様</p>

  <p>定期支援の解約手続きが完了しました。</p>

  <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>終了日:</strong> ${endDateFormatted}</p>
  </div>

  <p>上記の日付まで定期支援の特典をご利用いただけます。</p>

  <p>これまでのご支援、誠にありがとうございました。</p>

  <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">

  <p style="color: #999; font-size: 12px;">
    このメールは ${SITE_NAME} (${APP_URL}) から送信されました。
  </p>
</body>
</html>
  `.trim();

  const text = `
定期支援の解約を受け付けました

${donorName} 様

定期支援の解約手続きが完了しました。

終了日: ${endDateFormatted}

上記の日付まで定期支援の特典をご利用いただけます。

これまでのご支援、誠にありがとうございました。

---
${SITE_NAME} (${APP_URL})
  `.trim();

  return sendEmail({
    to: email,
    subject: `【${SITE_NAME}】定期支援の解約を受け付けました`,
    html,
    text,
  });
}

// === Utility ===

/**
 * Check if email service is configured
 */
export function isEmailConfigured(): boolean {
  return !!RESEND_API_KEY;
}
