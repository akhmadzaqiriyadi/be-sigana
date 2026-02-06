import { IEmailProvider } from "./email.types";
import { SmtpProvider } from "./providers/smtp.provider";

class EmailService {
  private provider: IEmailProvider;

  constructor() {
    // Default to SMTP
    this.provider = new SmtpProvider();
  }

  async sendPasswordResetEmail(
    to: string,
    resetLink: string,
    userName: string
  ) {
    return this.provider.sendPasswordResetEmail(to, resetLink, userName);
  }
}

export const emailService = new EmailService();
