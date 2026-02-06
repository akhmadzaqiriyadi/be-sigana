import nodemailer from "nodemailer";
import { env } from "@/config/env";
import { IEmailProvider } from "../email.types";

export class SmtpProvider implements IEmailProvider {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465, // true for 465, false for other ports
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });
  }

  async sendPasswordResetEmail(
    to: string,
    resetLink: string,
    userName: string
  ): Promise<void> {
    await this.transporter.sendMail({
      from: env.SMTP_FROM_EMAIL,
      to,
      subject: "Reset Password - SIGANA",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Halo, ${userName}</h2>
          <p>Anda menerima email ini karena adanya permintaan reset password untuk akun SIGANA Anda.</p>
          <p>Silakan klik tombol di bawah ini untuk mengatur ulang password Anda:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p>Link ini valid selama <strong>1 jam</strong>.</p>
          <p>Jika Anda tidak merasa meminta reset password, abaikan email ini.</p>
        </div>
      `,
    });
  }
}
