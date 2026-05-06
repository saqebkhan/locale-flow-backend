import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { logger } from '../utils/logger.js';

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
  if (!projectDetail?._id || !translation?._id) {
    console.error('Missing project or translation detail for email');
    return;
  }
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

export const sendVerificationEmail = async (email: string, name: string, token: string) => {
  const verifyLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email?token=${token}`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
      <h2 style="color: #6366f1;">Verify Your Email</h2>
      <p>Hi ${name},</p>
      <p>Welcome to <b>Locale Flow</b>! Please click the button below to verify your email address and get started.</p>
      <a href="${verifyLink}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">Verify Email</a>
      <p style="color: #64748b; font-size: 12px;">If you didn't create an account, you can safely ignore this email.</p>
    </div>
  `;

  const transporter = getTransporter();
  if (transporter) {
    return transporter.sendMail({
      from: `"Locale Flow" <${FROM_EMAIL}>`,
      to: email,
      subject: `📧 Verify your email for Locale Flow`,
      html
    });
  }

  const resend = getResend();
  if (resend) {
    return resend.emails.send({
      from: `Locale Flow <onboarding@resend.dev>`,
      to: email,
      subject: `📧 Verify your email for Locale Flow`,
      html
    });
  }

  console.warn('⚠️ No email provider configured (SMTP or Resend).');
};

export const sendPasswordResetEmail = async (email: string, name: string, token: string) => {
  const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
      <h2 style="color: #ef4444;">Reset Your Password</h2>
      <p>Hi ${name},</p>
      <p>We received a request to reset your password for <b>Locale Flow</b>.</p>
      <p>Click the button below to set a new password. This link will expire in 1 hour.</p>
      <a href="${resetLink}" style="display: inline-block; background: #ef4444; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">Reset Password</a>
      <p style="color: #64748b; font-size: 12px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  try {
    // 1. Try SMTP first (to use saqebk619@gmail.com as sender)
    const transporter = getTransporter();
    if (transporter) {
      logger.info(`Attempting to send password reset email to ${email} via SMTP...`);
      return await transporter.sendMail({
        from: `"Locale Flow" <${FROM_EMAIL}>`,
        to: email,
        subject: `🔒 Password Reset Request`,
        html
      });
    }

    // 2. Fallback to Resend
    const resend = getResend();
    if (resend) {
      logger.info(`Attempting to send password reset email to ${email} via Resend...`);
      return await resend.emails.send({
        from: `Locale Flow <onboarding@resend.dev>`,
        to: email,
        subject: `🔒 Password Reset Request`,
        html
      });
    }

    logger.warn('⚠️ No email provider configured (SMTP or Resend). Password reset email not sent.');
  } catch (error: any) {
    logger.error(`Failed to send password reset email to ${email}:`, error);
    
    // Final attempt: If SMTP failed, try Resend immediately as a last resort
    // We only do this if we haven't already successfully sent it
    const resend = getResend();
    if (resend) { 
      try {
        logger.info(`Primary method failed, trying emergency fallback to Resend for ${email}...`);
        return await resend.emails.send({
          from: `Locale Flow <onboarding@resend.dev>`,
          to: email,
          subject: `🔒 Password Reset Request`,
          html
        });
      } catch (innerError) {
        logger.error(`Emergency Resend fallback also failed for ${email}`);
      }
    }
    throw error;
  }
};
