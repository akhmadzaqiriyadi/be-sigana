export interface IEmailProvider {
  sendPasswordResetEmail(
    to: string,
    resetLink: string,
    userName: string
  ): Promise<void>;
}
