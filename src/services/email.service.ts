import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// Helper to get SMTP transporter
const getTransporter = () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
};

// Helper to get Resend instance
const getResend = () => {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
};

const FROM_EMAIL = process.env.SMTP_USER || 'onboarding@resend.dev';

export const sendApprovalEmail = async (adminEmail: string, projectDetail: any, translation: any) => {
  const approvalLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/projects/${projectDetail._id}?approve=${translation._id}`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
      <h2 style="color: #6366f1;">Approval Required</h2>
      <p>A new translation key has been added to <b>${projectDetail.name}</b>.</p>
      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0; color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: bold;">Key</p>
        <p style="margin: 5px 0 15px; font-family: monospace;">${translation.key}</p>
        <p style="margin: 0; color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: bold;">Value (${translation.language})</p>
        <p style="margin: 5px 0;">${translation.value}</p>
      </div>
      <a href="${approvalLink}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">Review and Approve</a>
    </div>
  `;

  // 1. Try SMTP (Gmail)
  const transporter = getTransporter();
  if (transporter) {
    return transporter.sendMail({
      from: `"Locale Flow" <${FROM_EMAIL}>`,
      to: adminEmail,
      subject: `⚠️ Approval Required: "${translation.key}"`,
      html
    });
  }

  // 2. Fallback to Resend
  const resend = getResend();
  if (resend) {
    return resend.emails.send({
      from: `Locale Flow <onboarding@resend.dev>`,
      to: adminEmail,
      subject: `⚠️ Approval Required: "${translation.key}"`,
      html
    });
  }

  console.warn('⚠️ No email provider configured (SMTP or Resend).');
};

export const sendInvitationEmail = async (email: string, projectDetail: any, role: string, token: string) => {
  const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invitation?token=${token}`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
      <h2 style="color: #6366f1;">Join the Team</h2>
      <p>You've been invited to join <b>${projectDetail.name}</b> as an <b>${role}</b>.</p>
      <a href="${inviteLink}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">Accept Invitation</a>
    </div>
  `;

  // 1. Try SMTP (Gmail)
  const transporter = getTransporter();
  if (transporter) {
    return transporter.sendMail({
      from: `"Locale Flow" <${FROM_EMAIL}>`,
      to: email,
      subject: `🚀 Join the team at "${projectDetail.name}"`,
      html
    });
  }

  // 2. Fallback to Resend
  const resend = getResend();
  if (resend) {
    return resend.emails.send({
      from: `Locale Flow <onboarding@resend.dev>`,
      to: email,
      subject: `🚀 Join the team at "${projectDetail.name}"`,
      html
    });
  }

  console.warn('⚠️ No email provider configured (SMTP or Resend).');
};
