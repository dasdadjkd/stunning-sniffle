import { mailpitMailbox } from './otp.mjs';
import { imapMailbox } from './otp-imap.mjs';

export const PROVIDERS = ['mailpit', 'imap'];

/** Builds the code reader for the configured provider. */
export async function buildMailbox(config) {
  switch (config.otpProvider) {
    case 'mailpit':
      return mailpitMailbox({ url: config.mailpitUrl });
    case 'imap':
      return imapMailbox(config.imap);
    default:
      throw new Error(
        `unknown OTP_PROVIDER "${config.otpProvider}"; expected one of ${PROVIDERS.join(', ')}`,
      );
  }
}
