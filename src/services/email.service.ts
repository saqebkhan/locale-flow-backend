import { Resend } from 'resend';

// Initialize Resend with API Key from environment variables
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM_EMAIL = 'Locale Flow <onboarding@resend.dev>'; // Resend's default test sender

export const sendApprovalEmail = async (adminEmail: string, projectDetail: any, translation: any) => {
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY is not set. Email will not be sent.');
    return;
  }

  const approvalLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/projects/${projectDetail._id}?approve=${translation._id}`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `⚠️ Action Required: Approve "${translation.key}"`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; background-color: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e5e7eb; shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background-color: #6366f1; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; color: white; font-weight: bold; font-style: italic; font-size: 24px;">L</div>
            <h2 style="color: #111827; margin: 0 0 16px; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">Approval Required</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
              A new translation key has been proposed for <b>Production</b> in <b>${projectDetail.name}</b>.
            </p>
            
            <div style="background-color: #f3f4f6; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Key</p>
              <p style="margin: 4px 0 16px; color: #111827; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 600;">${translation.key}</p>
              
              <p style="margin: 0; color: #6b7280; font-size: 12px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Value (${translation.language})</p>
              <p style="margin: 4px 0; color: #111827; font-size: 15px; line-height: 1.5;">${translation.value}</p>
            </div>

            <a href="${approvalLink}" style="display: inline-block; width: 100%; background-color: #6366f1; color: white; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: 700; text-align: center; font-size: 16px;">Review and Approve</a>
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 32px;">
              This is an automated notification from your Locale Translation Platform.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend Error:', error);
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Failed to send approval email:', error);
    throw error;
  }
};

export const sendInvitationEmail = async (email: string, projectDetail: any, role: string, token: string) => {
  if (!resend) {
    console.warn('⚠️ RESEND_API_KEY is not set. Invitation will not be sent.');
    return;
  }

  const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invitation?token=${token}`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `🚀 Join the team at "${projectDetail.name}"`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; background-color: #f9fafb;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e5e7eb;">
            <div style="background-color: #6366f1; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 24px; color: white; font-weight: bold; font-style: italic; font-size: 24px;">L</div>
            <h2 style="color: #111827; margin: 0 0 16px; font-size: 24px; font-weight: 800;">Welcome to the Team!</h2>
            <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin-bottom: 24px;">
              You've been invited to collaborate on <b>${projectDetail.name}</b> with the role of <b>${role}</b>.
            </p>
            <p style="color: #4b5563; font-size: 16px; line-height: 24px; margin-bottom: 32px;">
              Locale Flow makes it easy to manage translations and keep your app multi-lingual in real-time.
            </p>
            <a href="${inviteLink}" style="display: inline-block; width: 100%; background-color: #6366f1; color: white; padding: 14px 24px; border-radius: 12px; text-decoration: none; font-weight: 700; text-align: center; font-size: 16px;">Accept Invitation</a>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 32px;">
              If you weren't expecting this, you can ignore this email.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error('Resend Error:', error);
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    throw error;
  }
};
