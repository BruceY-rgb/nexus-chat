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
  <title>你的登录验证码 - ${appName}</title>
</head>

<body style="margin:0; padding:0; background-color:#f6f6f6;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:48px 16px;">

        <!-- Card -->
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
          style="background-color:#ffffff; border-radius:12px;">

          <!-- Header -->
          <tr>
            <td style="padding:28px 36px 20px 36px; font-family: Helvetica, Arial, sans-serif;">
              <table width="100%" role="presentation">
                <tr>
                  <td style="font-size:18px; font-weight:600; color:#1d1c1d;">
                    ${appName}
                  </td>
                  <td align="right" style="font-size:12px; color:#9e9ea2;">
                    登录验证
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Soft divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px; background-color:#ebebeb;"></div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="
              padding:32px 36px;
              font-family: Helvetica, Arial, sans-serif;
              color:#1d1c1d;
              font-size:15px;
              line-height:1.6;
            ">
              <p style="margin:0 0 12px;">你好 👋</p>

              <p style="margin:0 0 24px;">
                我们刚刚收到了你的登录请求。  
                Please enter下面的验证码以继续：
              </p>

              <!-- Code block -->
              <table width="100%" role="presentation"
                style="background-color:#f8f7f9; border-radius:10px;">
                <tr>
                  <td align="center" style="padding:28px 16px;">
                    <div style="
                      font-size:32px;
                      font-weight:700;
                      letter-spacing:6px;
                      color:#4a154b;
                    ">
                      ${code}
                    </div>
                    <div style="
                      margin-top:8px;
                      font-size:13px;
                      color:#696969;
                    ">
                      5 分钟内有效
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Hint -->
              <p style="
                margin:24px 0 0;
                font-size:13px;
                color:#696969;
              ">
                如果你没有尝试登录，可以放心忽略这封邮件。
              </p>
            </td>
          </tr>

          <!-- Footer divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px; background-color:#ebebeb;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="
              padding:18px 36px 28px;
              font-family: Helvetica, Arial, sans-serif;
              font-size:12px;
              color:#9e9ea2;
            ">
              <p style="margin:0;">
                此邮件由系统自动发送，请勿回复。
              </p>
            </td>
          </tr>

        </table>

        <!-- Bottom space -->
        <p style="
          margin:16px 0 0;
          font-family: Helvetica, Arial, sans-serif;
          font-size:12px;
          color:#b5b5b5;
        ">
          © 2026 ${appName}
        </p>

      </td>
    </tr>
  </table>
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

© 2026 ${appName}. 保留所有权利。
`;
}

/**
 * 邮件主题模板
 */
export function getVerificationEmailSubject(appName = 'Slack聊天应用'): string {
  return `${appName} - 登录验证码`;
}
