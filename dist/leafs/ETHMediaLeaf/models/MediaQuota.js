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
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, Default, CreatedAt, UpdatedAt, Unique, DataType, } from '../../../components/database/provider.js';
export class BaseMediaQuota extends Model {
    /**
     * Get human readable storage used
     */
    getStorageUsedHuman() {
        return this.formatBytes(this.storage_used);
    }
    /**
     * Get human readable quota limit
     */
    getQuotaLimitHuman(globalQuota) {
        var _a;
        const limit = (_a = this.custom_quota) !== null && _a !== void 0 ? _a : globalQuota;
        return this.formatBytes(limit);
    }
    /**
     * Check if user has exceeded quota
     */
    hasExceededQuota(globalQuota) {
        var _a;
        const limit = (_a = this.custom_quota) !== null && _a !== void 0 ? _a : globalQuota;
        return this.storage_used >= limit;
    }
    /**
     * Check if adding a file would exceed quota
     */
    wouldExceedQuota(fileSize, globalQuota) {
        var _a;
        const limit = (_a = this.custom_quota) !== null && _a !== void 0 ? _a : globalQuota;
        return (this.storage_used + fileSize) > limit;
    }
    /**
     * Get remaining storage in bytes
     */
    getRemainingStorage(globalQuota) {
        var _a;
        const limit = (_a = this.custom_quota) !== null && _a !== void 0 ? _a : globalQuota;
        return Math.max(0, limit - this.storage_used);
    }
    /**
     * Get usage percentage (0-100)
     */
    getUsagePercentage(globalQuota) {
        var _a;
        const limit = (_a = this.custom_quota) !== null && _a !== void 0 ? _a : globalQuota;
        if (limit === 0)
            return 100;
        return Math.min(100, Math.round((this.storage_used / limit) * 100));
    }
    formatBytes(bytes) {
        if (bytes === 0)
            return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    /**
     * Increment storage usage
     */
    addUsage(fileSize) {
        return __awaiter(this, void 0, void 0, function* () {
            this.storage_used = Number(this.storage_used) + fileSize;
            this.file_count = this.file_count + 1;
            yield this.save();
        });
    }
    /**
     * Decrement storage usage
     */
    removeUsage(fileSize) {
        return __awaiter(this, void 0, void 0, function* () {
            this.storage_used = Math.max(0, Number(this.storage_used) - fileSize);
            this.file_count = Math.max(0, this.file_count - 1);
            yield this.save();
        });
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], BaseMediaQuota.prototype, "id", void 0);
__decorate([
    Unique,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], BaseMediaQuota.prototype, "user_id", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.BIGINT),
    __metadata("design:type", Number)
], BaseMediaQuota.prototype, "storage_used", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column,
    __metadata("design:type", Number)
], BaseMediaQuota.prototype, "file_count", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.BIGINT),
    __metadata("design:type", Number)
], BaseMediaQuota.prototype, "custom_quota", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseMediaQuota.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date
    /**
     * Get human readable storage used
     */
    )
], BaseMediaQuota.prototype, "updated_at", void 0);
