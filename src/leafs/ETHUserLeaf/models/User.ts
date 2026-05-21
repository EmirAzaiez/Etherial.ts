import {
    Table,
    Column,
    Model,
    AllowNull,
    PrimaryKey,
    AutoIncrement,
    HasMany,
    Unique,
    Default,
    CreatedAt,
    UpdatedAt,
    DataType,
    DefaultScope,
} from 'etherial/components/database/provider'
import * as crypto from 'crypto'

export const USER_EXCLUDE_ATTRIBUTES_DEFAULT_SCOPE = [
    'password',
    'google_id',
    'apple_id',
    'email_confirmation_token',
    'password_reset_token',
    'password_reset_requested_at',
    'password_reset_expires_at',
    'failed_login_attempts',
    'last_failed_login',
    'deleted_at',
    'credentials_expired',
    'credentials_expire_at',
    'email_confirmed',
    'email_confirmed_at',
    'terms_accepted',
    'terms_accepted_at',
    'privacy_policy_accepted',
    'privacy_policy_accepted_at',
    'marketing_emails_enabled',
    'phone_verification_token',
]

export abstract class UserLeafBase extends Model<any> {
    @AutoIncrement
    @PrimaryKey
    @AllowNull(false)
    @Column
    id: number

    @AllowNull(false)
    @Column
    firstname: string

    @AllowNull(false)
    @Column
    lastname: string

    @AllowNull(true)
    @Column
    username: string

    @Unique
    @AllowNull(false)
    @Column
    email: string

    @AllowNull(true)
    @Column(DataType.TEXT)
    password: string

    @AllowNull(true)
    @Column
    google_id: string

    @AllowNull(true)
    @Column
    apple_id: string

    @Default(true)
    @AllowNull(false)
    @Column
    enabled: boolean

    @Default(false)
    @AllowNull(false)
    @Column
    credentials_expired: boolean

    @Default(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))
    @AllowNull(true)
    @Column
    credentials_expire_at: Date

    @AllowNull(true)
    @Column
    email_confirmation_token: string

    @AllowNull(true)
    @Column
    email_confirmation_expires_at: Date

    @Default(0)
    @AllowNull(false)
    @Column
    email_confirmation_attempts: number

    @Default(false)
    @AllowNull(false)
    @Column
    email_confirmed: boolean

    @AllowNull(true)
    @Column
    email_confirmed_at: Date

    @AllowNull(false)
    @Default(false)
    @Column
    should_set_password: boolean

    @AllowNull(true)
    @Column
    password_reset_token: string

    @AllowNull(true)
    @Column
    password_reset_requested_at: Date

    @AllowNull(true)
    @Column
    password_reset_expires_at: Date

    @Default(1)
    @AllowNull(false)
    @Column
    role: number

    @AllowNull(true)
    @Column
    last_login: Date

    @AllowNull(true)
    @Column
    last_activity: Date

    @Default(0)
    @AllowNull(false)
    @Column
    login_count: number

    @Default(0)
    @AllowNull(false)
    @Column
    failed_login_attempts: number

    @AllowNull(true)
    @Column
    last_failed_login: Date

    /**
     * Monotonic version of issued JWTs. Embedded as `tv` in the payload at sign time
     * and verified in authMiddleware. Bump this to revoke every outstanding token
     * (password reset, "log out everywhere", role downgrade, etc.).
     */
    @Default(0)
    @AllowNull(false)
    @Column
    token_version: number

    @Unique
    @AllowNull(true)
    @Column
    phone: string

    @Default(false)
    @AllowNull(false)
    @Column
    phone_verified: boolean

    @AllowNull(true)
    @Column
    phone_temporary: string

    @AllowNull(true)
    @Column
    phone_verification_token: string

    @AllowNull(true)
    @Column
    phone_verification_expires_at: Date

    @Default(0)
    @AllowNull(false)
    @Column
    phone_verification_attempts: number

    @AllowNull(true)
    @Column
    phone_verified_at: Date

    @AllowNull(true)
    @Column
    avatar: string

    @Default('{}')
    @AllowNull(true)
    @Column(DataType.JSON)
    metadata: Record<string, any>

    @AllowNull(true)
    @Column
    birth_date: Date

    @AllowNull(true)
    @Column
    gender: string

    @Default(false)
    @AllowNull(false)
    @Column
    terms_accepted: boolean

    @AllowNull(true)
    @Column
    terms_accepted_at: Date

    @Default(false)
    @AllowNull(false)
    @Column
    privacy_policy_accepted: boolean

    @AllowNull(true)
    @Column
    privacy_policy_accepted_at: Date

    @Default(true)
    @AllowNull(false)
    @Column
    marketing_emails_enabled: boolean

    @AllowNull(true)
    @Column(DataType.TEXT)
    bio: string

    @AllowNull(true)
    @Column
    deleted_at: Date

    @CreatedAt
    created_at: Date

    @UpdatedAt
    updated_at: Date

    isActive(): boolean {
        return this.enabled && !this.credentials_expired && (this.credentials_expire_at ? this.credentials_expire_at > new Date() : true)
    }

    getFullName(): string {
        return `${this.firstname} ${this.lastname}`.trim()
    }

    /**
     * Maximum failed confirmation attempts before a token is burned.
     * Override in your User model if you need a different limit.
     */
    static readonly CONFIRMATION_MAX_ATTEMPTS: number = 5

    /**
     * Constant-time comparison of a candidate token against a stored hash.
     * Returns false safely on shape mismatch.
     */
    static verifyTokenHash(candidate: string | undefined | null, storedHash: string | undefined | null): boolean {
        if (!candidate || !storedHash) {
            return false
        }
        const candidateHash = crypto.createHash('sha256').update(candidate).digest()
        let storedBuf: Buffer
        try {
            storedBuf = Buffer.from(storedHash, 'hex')
        } catch {
            return false
        }
        if (storedBuf.length !== candidateHash.length) {
            return false
        }
        return crypto.timingSafeEqual(candidateHash, storedBuf)
    }

    /**
     * Hash a token for at-rest storage. Confirmation/reset tokens are
     * short-lived secrets — store only the SHA-256 hash so a DB leak does not
     * grant attackers usable tokens.
     */
    static hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex')
    }

    isConfirmationTokenValid(token: string, type?: 'email' | 'phone'): boolean {
        const ctor = this.constructor as typeof UserLeafBase

        if (type === 'phone') {
            if (this.phone_verified) return false
            if (!this.phone_verification_expires_at || this.phone_verification_expires_at <= new Date()) return false
            if (this.phone_verification_attempts >= ctor.CONFIRMATION_MAX_ATTEMPTS) return false
            return ctor.verifyTokenHash(token, this.phone_verification_token)
        }

        if (this.email_confirmed) return false
        if (!this.email_confirmation_expires_at || this.email_confirmation_expires_at <= new Date()) return false
        if (this.email_confirmation_attempts >= ctor.CONFIRMATION_MAX_ATTEMPTS) return false
        return ctor.verifyTokenHash(token, this.email_confirmation_token)
    }

    isPasswordResetTokenValid(token: string): boolean {
        if (!this.password_reset_expires_at || this.password_reset_expires_at <= new Date()) {
            return false
        }
        const ctor = this.constructor as typeof UserLeafBase
        return ctor.verifyTokenHash(token, this.password_reset_token)
    }

    async sendEmailForPasswordReset(resetToken: string): Promise<void> {
        // TODO: Send email with reset token
        console.log(`Password reset token for ${this.email}: ${resetToken}`)
    }

    async sendEmailForEmailVerification(confirmationToken): Promise<void> {
        // TODO: Send email with confirmation token
        console.log(`Email confirmation token for ${this.email}: ${confirmationToken}`)
    }

    async sendEmailForPasswordNotification(type: string): Promise<void> {
        // Override in your User model to send password notification emails
        console.log(`Password ${type} notification for ${this.email}`)
    }

    async sendSmsForPhoneVerification(code: string): Promise<void> {
        // Override in your User model to send SMS verification
        console.log(`Phone verification code for ${this.phone_temporary || this.phone}: ${code}`)
    }

    async insertAuditLog(data: { req?: any; action: string; status: string; resource: string; metadata?: Record<string, any> }): Promise<void> {
        // Override in your User model to implement audit logging
        console.log(`Audit log: ${data.action} - ${data.status}`)
    }

    static async createOrFetchUserFromGoogle(profile_id: string, firstname: string, lastname: string, email: string): Promise<UserLeafBase> {
        console.log('createOrFetchUserFromGoogle')
        return
    }

    static async createOrFetchUserFromApple(appleId: string, email: string, firstname: string, lastname: string): Promise<UserLeafBase> {
        console.log('createOrFetchUserFromApple')
        return
    }
}
