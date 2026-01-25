// =====================================================
// 邮件模板
// =====================================================

interface VerificationEmailData {
  email: string;
  code: string;
  appName?: string;
}

/**
 * 生成HTML邮件模板
 */
export function generateVerificationEmailHTML(data: VerificationEmailData): string {
  const { email, code, appName = 'Slack聊天应用' } = data;

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>登录验证码 - ${appName}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      background-color: #f4f4f4;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #1264A3 0%, #0E5A87 100%);
      padding: 40px 20px;
      text-align: center;
    }
    .logo {
      width: 60px;
      height: 60px;
      background-color: #fff;
      border-radius: 12px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: bold;
      color: #1264A3;
    }
    .header h1 {
      margin: 0;
      color: #fff;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .greeting {
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 30px;
      color: #555;
    }
    .code-container {
      background-color: #f8f9fa;
      border: 2px dashed #1264A3;
      border-radius: 12px;
      padding: 30px;
      text-align: center;
      margin: 30px 0;
    }
    .code-label {
      font-size: 14px;
      color: #666;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .verification-code {
      font-size: 42px;
      font-weight: bold;
      color: #1264A3;
      letter-spacing: 8px;
      margin: 10px 0;
      font-family: 'Courier New', monospace;
    }
    .code-hint {
      font-size: 14px;
      color: #888;
      margin-top: 15px;
    }
    .warning {
      background-color: #fff3cd;
      border: 1px solid #ffeaa7;
      border-radius: 6px;
      padding: 15px;
      margin: 25px 0;
      font-size: 14px;
      color: #856404;
      line-height: 1.5;
    }
    .warning-icon {
      display: inline-block;
      margin-right: 8px;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
      color: #999;
      border-top: 1px solid #eee;
    }
    .footer p {
      margin: 5px 0;
    }
    .link {
      color: #1264A3;
      text-decoration: none;
    }
    @media (max-width: 600px) {
      .container {
        margin: 20px;
        border-radius: 0;
      }
      .header, .content {
        padding: 30px 20px;
      }
      .verification-code {
        font-size: 36px;
        letter-spacing: 6px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">💬</div>
      <h1>${appName}</h1>
    </div>

    <div class="content">
      <div class="greeting">
        <p>您好，</p>
        <p>我们收到了您的登录请求。请使用以下验证码完成登录：</p>
      </div>

      <div class="code-container">
        <div class="code-label">验证码</div>
        <div class="verification-code">${code}</div>
        <div class="code-hint">请在 5 分钟内使用此验证码</div>
      </div>

      <div class="warning">
        <span class="warning-icon">⚠️</span>
        <strong>安全提醒：</strong><br>
        • 此验证码仅限本人使用，请勿泄露给他人<br>
        • 如果您未发起登录请求，请忽略此邮件<br>
        • 为保障账户安全，请勿将验证码告诉任何人
      </div>

      <div class="greeting" style="margin-top: 30px; font-size: 14px; color: #888;">
        <p>此邮件由系统自动发送，请勿回复。</p>
      </div>
    </div>

    <div class="footer">
      <p>© 2026 ${appName}. 保留所有权利。</p>
      <p>如果您有任何疑问，请联系我们的 <a href="#" class="link">客服团队</a></p>
    </div>
  </div>
</body>
</html>
`;
}

/**
 * 生成纯文本邮件模板（作为备用）
 */
export function generateVerificationEmailText(data: VerificationEmailData): string {
  const { email, code, appName = 'Slack聊天应用' } = data;

  return `
${appName} - 登录验证码

您好，

我们收到了您的登录请求。请使用以下验证码完成登录：

验证码：${code}

请在 5 分钟内使用此验证码。

安全提醒：
• 此验证码仅限本人使用，请勿泄露给他人
• 如果您未发起登录请求，请忽略此邮件
• 为保障账户安全，请勿将验证码告诉任何人

此邮件由系统自动发送，请勿回复。

© 2024 ${appName}. 保留所有权利。
`;
}

/**
 * 邮件主题模板
 */
export function getVerificationEmailSubject(appName = 'Slack聊天应用'): string {
  return `${appName} - 登录验证码`;
}
