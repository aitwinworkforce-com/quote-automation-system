/**
 * Quote email service — sends the finalized quotation PDF to the customer.
 *
 * Uses SMTP via nodemailer, driven by environment variables so credentials
 * can be changed without code edits:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 *
 * Works with any provider (e.g. Microsoft 365: smtp.office365.com:587,
 * Gmail app passwords: smtp.gmail.com:587, Resend: smtp.resend.com:465).
 */
import nodemailer from "nodemailer";

export interface QuoteEmailInput {
  to: string;
  cc?: string;
  subject: string;
  message: string;
  attachment: {
    filename: string;
    content: Buffer;
  };
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendQuoteEmail(input: QuoteEmailInput): Promise<{ messageId: string }> {
  if (!isEmailConfigured()) {
    throw new Error(
      "Email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM in project secrets.",
    );
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const htmlMessage = input.message
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 12px 0;">${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: input.to,
    cc: input.cc || undefined,
    subject: input.subject,
    text: input.message,
    html: `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1a2b45; line-height: 1.55;">${htmlMessage}</div>`,
    attachments: [
      {
        filename: input.attachment.filename,
        content: input.attachment.content,
        contentType: "application/pdf",
      },
    ],
  });
  return { messageId: info.messageId };
}
