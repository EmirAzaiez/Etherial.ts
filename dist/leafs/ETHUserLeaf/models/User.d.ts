import { Model } from 'etherial/components/database/provider';
export declare const USER_EXCLUDE_ATTRIBUTES_DEFAULT_SCOPE: string[];
export declare abstract class UserLeafBase extends Model<any> {
    id: number;
    firstname: string;
    lastname: string;
    username: string;
    email: string;
    password: string;
    google_id: string;
    apple_id: string;
    enabled: boolean;
    credentials_expired: boolean;
    credentials_expire_at: Date;
    email_confirmation_token: string;
    email_confirmation_expires_at: Date;
    email_confirmation_attempts: number;
    email_confirmed: boolean;
    email_confirmed_at: Date;
    should_set_password: boolean;
    password_reset_token: string;
    password_reset_requested_at: Date;
    password_reset_expires_at: Date;
    role: number;
    last_login: Date;
    last_activity: Date;
    login_count: number;
    failed_login_attempts: number;
    last_failed_login: Date;
    /**
     * Monotonic version of issued JWTs. Embedded as `tv` in the payload at sign time
     * and verified in authMiddleware. Bump this to revoke every outstanding token
     * (password reset, "log out everywhere", role downgrade, etc.).
     */
    token_version: number;
    phone: string;
    phone_verified: boolean;
    phone_temporary: string;
    phone_verification_token: string;
    phone_verification_expires_at: Date;
    phone_verification_attempts: number;
    phone_verified_at: Date;
    avatar: string;
    metadata: Record<string, any>;
    birth_date: Date;
    gender: string;
    terms_accepted: boolean;
    terms_accepted_at: Date;
    privacy_policy_accepted: boolean;
    privacy_policy_accepted_at: Date;
    marketing_emails_enabled: boolean;
    bio: string;
    deleted_at: Date;
    created_at: Date;
    updated_at: Date;
    isActive(): boolean;
    getFullName(): string;
    /**
     * Maximum failed confirmation attempts before a token is burned.
     * Override in your User model if you need a different limit.
     */
    static readonly CONFIRMATION_MAX_ATTEMPTS: number;
    /**
     * Constant-time comparison of a candidate token against a stored hash.
     * Returns false safely on shape mismatch.
     */
    static verifyTokenHash(candidate: string | undefined | null, storedHash: string | undefined | null): boolean;
    /**
     * Hash a token for at-rest storage. Confirmation/reset tokens are
     * short-lived secrets — store only the SHA-256 hash so a DB leak does not
     * grant attackers usable tokens.
     */
    static hashToken(token: string): string;
    isConfirmationTokenValid(token: string, type?: 'email' | 'phone'): boolean;
    isPasswordResetTokenValid(token: string): boolean;
    sendEmailForPasswordReset(resetToken: string): Promise<void>;
    sendEmailForEmailVerification(confirmationToken: any): Promise<void>;
    sendEmailForPasswordNotification(type: string): Promise<void>;
    sendSmsForPhoneVerification(code: string): Promise<void>;
    insertAuditLog(data: {
        req?: any;
        action: string;
        status: string;
        resource: string;
        metadata?: Record<string, any>;
    }): Promise<void>;
    static createOrFetchUserFromGoogle(profile_id: string, firstname: string, lastname: string, email: string): Promise<UserLeafBase>;
    static createOrFetchUserFromApple(appleId: string, email: string, firstname: string, lastname: string): Promise<UserLeafBase>;
}
