import nodemailer from 'nodemailer';

const getTransporter = async () => {
  // For development, we'll use a test account from ethereal.email
  // In production, this should be replaced with real SMTP credentials in .env
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

  // Fallback to Ethereal for testing
  let testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
};

export const sendApprovalEmail = async (adminEmail: string, projectDetail: any, translation: any) => {
  const transporter = await getTransporter();
  const approvalLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/projects/${projectDetail._id}?approve=${translation._id}`;

  let info = await transporter.sendMail({
    from: '"Locale Flow" <no-reply@localeflow.app>',
    to: adminEmail,
    subject: `⚠️ Approval Required: "${translation.key}"`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
        <h2 style="color: #6366f1;">Approval Required</h2>
        <p>A new translation key has been added to the <b>Production</b> environment of <b>${projectDetail.name}</b>.</p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: bold;">Key</p>
          <p style="margin: 5px 0 15px; font-family: monospace;">${translation.key}</p>
          <p style="margin: 0; color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: bold;">Value (${translation.language})</p>
          <p style="margin: 5px 0;">${translation.value}</p>
        </div>
        <a href="${approvalLink}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">Review and Approve</a>
      </div>
    `,
  });

  console.log("Approval Email Preview: %s", nodemailer.getTestMessageUrl(info));
  return info;
};

export const sendInvitationEmail = async (email: string, projectDetail: any, role: string, token: string) => {
  const transporter = await getTransporter();
  const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/accept-invitation?token=${token}`;

  let info = await transporter.sendMail({
    from: '"Locale Flow" <invites@localeflow.app>',
    to: email,
    subject: `🚀 You've been invited to join "${projectDetail.name}"`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
        <h2 style="color: #6366f1;">Join the Team</h2>
        <p>You have been invited to join the project <b>${projectDetail.name}</b> as an <b>${role}</b>.</p>
        <p>Use the button below to accept the invitation and start translating:</p>
        <a href="${inviteLink}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">Accept Invitation</a>
        <p style="color: #94a3b8; font-size: 12px;">If you didn't expect this invitation, you can safely ignore this email.</p>
      </div>
    `,
  });

  console.log("Invitation Email Preview: %s", nodemailer.getTestMessageUrl(info));
  return info;
};
