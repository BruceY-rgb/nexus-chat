// =====================================================
// Email Templates
// =====================================================

interface VerificationEmailData {
  email: string;
  code: string;
  appName?: string;
}

/**
 * Generate HTML email template
 */
export function generateVerificationEmailHTML(
  data: VerificationEmailData,
): string {
  const { email, code, appName = "Slack Chat App" } = data;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Your Login Verification Code - ${appName}</title>
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
                    Login Verification
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
              <p style="margin:0 0 12px;">Hello 👋</p>

              <p style="margin:0 0 24px;">
                We received a login request from your account.
                Enter the verification code below to continue:
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
                      Valid for 5 minutes
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
                If you did not attempt to log in, you can safely ignore this email.
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
                This email was sent automatically. Please do not reply.
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
 * Generate plain text email template (as fallback)
 */
export function generateVerificationEmailText(
  data: VerificationEmailData,
): string {
  const { email, code, appName = "Slack Chat App" } = data;

  return `
${appName} - Login Verification Code

Hello,

We received your login request. Please use the following code to complete your login:

Verification Code: ${code}

Please use this code within 5 minutes.

Security Notice:
- This verification code is for your personal use only, do not share it with others
- If you did not initiate a login request, please ignore this email
- For account security, never share your verification code with anyone

This email was sent automatically. Please do not reply.

© 2026 ${appName}. All rights reserved.
`;
}

/**
 * Email subject template
 */
export function getVerificationEmailSubject(appName = "Slack Chat App"): string {
  return `${appName} - Login Verification Code`;
}
