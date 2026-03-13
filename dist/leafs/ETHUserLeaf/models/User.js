var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, Unique, Default, CreatedAt, UpdatedAt, DataType, } from 'etherial/components/database/provider';
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
];
export class UserLeafBase extends Model {
    isActive() {
        return this.enabled && !this.credentials_expired && (this.credentials_expire_at ? this.credentials_expire_at > new Date() : true);
    }
    getFullName() {
        return `${this.firstname} ${this.lastname}`.trim();
    }
    isConfirmationTokenValid(token, type) {
        if (type === 'phone') {
            return this.phone_verification_token === token && !this.phone_verified;
        }
        return this.email_confirmation_token === token && !this.email_confirmed;
    }
    isPasswordResetTokenValid(token) {
        return this.password_reset_token === token && this.password_reset_expires_at && this.password_reset_expires_at > new Date();
    }
    sendEmailForPasswordReset(resetToken) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: Send email with reset token
            console.log(`Password reset token for ${this.email}: ${resetToken}`);
        });
    }
    sendEmailForEmailVerification(confirmationToken) {
        return __awaiter(this, void 0, void 0, function* () {
            // TODO: Send email with confirmation token
            console.log(`Email confirmation token for ${this.email}: ${confirmationToken}`);
        });
    }
    sendEmailForPasswordNotification(type) {
        return __awaiter(this, void 0, void 0, function* () {
            // Override in your User model to send password notification emails
            console.log(`Password ${type} notification for ${this.email}`);
        });
    }
    sendSmsForPhoneVerification(code) {
        return __awaiter(this, void 0, void 0, function* () {
            // Override in your User model to send SMS verification
            console.log(`Phone verification code for ${this.phone_temporary || this.phone}: ${code}`);
        });
    }
    insertAuditLog(data) {
        return __awaiter(this, void 0, void 0, function* () {
            // Override in your User model to implement audit logging
            console.log(`Audit log: ${data.action} - ${data.status}`);
        });
    }
    static createOrFetchUserFromGoogle(profile_id, firstname, lastname, email) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('createOrFetchUserFromGoogle');
            return;
        });
    }
    static createOrFetchUserFromApple(appleId, email, firstname, lastname) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('createOrFetchUserFromApple');
            return;
        });
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], UserLeafBase.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column,
    __metadata("design:type", String)
], UserLeafBase.prototype, "firstname", void 0);
__decorate([
    AllowNull(false),
    Column,
    __metadata("design:type", String)
], UserLeafBase.prototype, "lastname", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], UserLeafBase.prototype, "username", void 0);
__decorate([
    Unique,
    AllowNull(false),
    Column,
    __metadata("design:type", String)
], UserLeafBase.prototype, "email", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], UserLeafBase.prototype, "password", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], UserLeafBase.prototype, "google_id", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], UserLeafBase.prototype, "apple_id", void 0);
__decorate([
    Default(true),
    AllowNull(false),
    Column,
    __metadata("design:type", Boolean)
], UserLeafBase.prototype, "enabled", void 0);
__decorate([
    Default(false),
    AllowNull(false),
    Column,
    __metadata("design:type", Boolean)
], UserLeafBase.prototype, "credentials_expired", void 0);
__decorate([
    Default(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], UserLeafBase.prototype, "credentials_expire_at", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], UserLeafBase.prototype, "email_confirmation_token", void 0);
__decorate([
    Default(false),
    AllowNull(false),
    Column,
    __metadata("design:type", Boolean)
], UserLeafBase.prototype, "email_confirmed", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], UserLeafBase.prototype, "email_confirmed_at", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column,
    __metadata("design:type", Boolean)
], UserLeafBase.prototype, "should_set_password", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], UserLeafBase.prototype, "password_reset_token", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], UserLeafBase.prototype, "password_reset_requested_at", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], UserLeafBase.prototype, "password_reset_expires_at", void 0);
__decorate([
    Default(1),
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], UserLeafBase.prototype, "role", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], UserLeafBase.prototype, "last_login", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], UserLeafBase.prototype, "last_activity", void 0);
__decorate([
    Default(0),
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], UserLeafBase.prototype, "login_count", void 0);
__decorate([
    Default(0),
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], UserLeafBase.prototype, "failed_login_attempts", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], UserLeafBase.prototype, "last_failed_login", void 0);
__decorate([
    Unique,
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], UserLeafBase.prototype, "phone", void 0);
__decorate([
    Default(false),
    AllowNull(false),
    Column,
    __metadata("design:type", Boolean)
], UserLeafBase.prototype, "phone_verified", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], UserLeafBase.prototype, "phone_temporary", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], UserLeafBase.prototype, "phone_verification_token", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], UserLeafBase.prototype, "phone_verified_at", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], UserLeafBase.prototype, "avatar", void 0);
__decorate([
    Default('{}'),
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], UserLeafBase.prototype, "metadata", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], UserLeafBase.prototype, "birth_date", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], UserLeafBase.prototype, "gender", void 0);
__decorate([
    Default(false),
    AllowNull(false),
    Column,
    __metadata("design:type", Boolean)
], UserLeafBase.prototype, "terms_accepted", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], UserLeafBase.prototype, "terms_accepted_at", void 0);
__decorate([
    Default(false),
    AllowNull(false),
    Column,
    __metadata("design:type", Boolean)
], UserLeafBase.prototype, "privacy_policy_accepted", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], UserLeafBase.prototype, "privacy_policy_accepted_at", void 0);
__decorate([
    Default(true),
    AllowNull(false),
    Column,
    __metadata("design:type", Boolean)
], UserLeafBase.prototype, "marketing_emails_enabled", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], UserLeafBase.prototype, "bio", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], UserLeafBase.prototype, "deleted_at", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], UserLeafBase.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date)
], UserLeafBase.prototype, "updated_at", void 0);
