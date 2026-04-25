import nodemailer from 'nodemailer';

export const sendApprovalEmail = async (adminEmail: string, projectDetail: any, translation: any) => {
  // For development, we'll use a test account from ethereal.email
  // In production, this would be replaced with SendGrid, Mailgun, etc.
  let testAccount = await nodemailer.createTestAccount();

  let transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false, 
    auth: {
      user: testAccount.user, 
      pass: testAccount.pass, 
    },
  });

  const approvalLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/projects/${projectDetail._id}?approve=${translation._id}`;

  let info = await transporter.sendMail({
    from: '"Locale AI" <no-reply@locale.app>',
    to: adminEmail,
    subject: "⚠️ Approval Required: New Production Key",
    text: `A new key "${translation.key}" was added to the Production environment of "${projectDetail.name}" and requires your approval.`,
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px; max-width: 600px;">
        <h2 style="color: #6366f1;">Approval Required</h2>
        <p>A new translation key has been added to the <b>Production</b> environment and requires admin approval.</p>
        
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold;">Project</p>
          <p style="margin: 5px 0 15px; font-weight: bold;">${projectDetail.name}</p>
          
          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold;">Key</p>
          <p style="margin: 5px 0 15px; font-family: monospace;">${translation.key}</p>
          
          <p style="margin: 0; color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: bold;">Value (${translation.language})</p>
          <p style="margin: 5px 0;">${translation.value}</p>
        </div>

        <a href="${approvalLink}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 25px; border-radius: 8px; text-decoration: none; font-weight: bold;">Review and Approve</a>
        
        <p style="color: #94a3b8; font-size: 12px; margin-top: 30px;">
          This is an automated notification from your Locale Translation Platform.
        </p>
      </div>
    `,
  });

  console.log("Message sent: %s", info.messageId);
  console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
  
  return info;
};
