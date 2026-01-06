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

    isConfirmationTokenValid(token: string): boolean {
        return this.email_confirmation_token === token && !this.email_confirmed
    }

    isPasswordResetTokenValid(token: string): boolean {
        return this.password_reset_token === token && this.password_reset_expires_at && this.password_reset_expires_at > new Date()
    }

    async sendEmailForPasswordReset(resetToken: string): Promise<void> {
        // TODO: Send email with reset token
        console.log(`Password reset token for ${this.email}: ${resetToken}`)
    }

    async sendEmailForEmailVerification(confirmationToken): Promise<void> {
        // TODO: Send email with confirmation token
        console.log(`Email confirmation token for ${this.email}: ${confirmationToken}`)
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
