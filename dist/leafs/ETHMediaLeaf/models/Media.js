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
import { Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DataType, Default, } from '../../../components/database/provider';
export var MediaStatus;
(function (MediaStatus) {
    MediaStatus["PENDING"] = "pending";
    MediaStatus["UPLOADED"] = "uploaded";
})(MediaStatus || (MediaStatus = {}));
/**
 * BaseMedia - Base class for Media model
 *
 * This class should be extended in your project to add:
 * - @Table decorator with table name
 * - @ForeignKey and @BelongsTo for User relationship
 *
 * @example
 * ```typescript
 * import { Table, ForeignKey, BelongsTo, Column, AllowNull } from 'etherial/components/database/provider'
 * import { BaseMedia } from '../ETHMediaLeaf/models/Media'
 * import { User } from './User'
 *
 * @Table({ tableName: 'medias', freezeTableName: true })
 * export class Media extends BaseMedia {
 *     @ForeignKey(() => User)
 *     @AllowNull(false)
 *     @Column
 *     declare uploaded_by: number
 *
 *     @BelongsTo(() => User, 'uploaded_by')
 *     declare uploader: User
 * }
 * ```
 */
export class BaseMedia extends Model {
    getFileExtension() {
        if (this.file_extension) {
            return this.file_extension;
        }
        const parts = this.real_name.split('.');
        return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
    }
    getHumanReadableSize() {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let size = this.file_size;
        let unitIndex = 0;
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }
    /**
     * Check if media is an image
     */
    isImage() {
        return this.mime_type.startsWith('image/');
    }
    /**
     * Check if media is a video
     */
    isVideo() {
        return this.mime_type.startsWith('video/');
    }
    /**
     * Check if media is audio
     */
    isAudio() {
        return this.mime_type.startsWith('audio/');
    }
    /**
     * Check if media is a document (PDF, DOC, etc.)
     */
    isDocument() {
        const docTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        return docTypes.includes(this.mime_type);
    }
    /**
     * Find all models that reference Media via BelongsTo associations
     * Scans all registered Sequelize models automatically
     *
     * @returns Array of { model, field, modelName } for each reference found
     */
    static findAllReferences() {
        var _a;
        const references = [];
        const sequelize = this.sequelize;
        if (!sequelize)
            return references;
        for (const [modelName, model] of Object.entries(sequelize.models)) {
            if (!model.associations)
                continue;
            for (const assoc of Object.values(model.associations)) {
                // Check if this is a BelongsTo pointing to medias table
                if (assoc.associationType === 'BelongsTo' && ((_a = assoc.target) === null || _a === void 0 ? void 0 : _a.tableName) === 'medias') {
                    references.push({
                        model,
                        field: assoc.foreignKey,
                        modelName,
                    });
                }
            }
        }
        return references;
    }
    /**
     * Find all orphan medias (confirmed but not referenced by any model)
     *
     * @param limit Max number of orphans to return (default: 100)
     * @returns Array of orphan Media records
     */
    static findOrphans() {
        return __awaiter(this, arguments, void 0, function* (limit = 100) {
            const { Op } = require('sequelize');
            const references = this.findAllReferences();
            // Get all confirmed media IDs
            const allMedias = yield this.findAll({
                where: { status: 'confirmed' },
                attributes: ['id'],
                raw: true,
            });
            if (allMedias.length === 0)
                return [];
            // Collect all used media IDs
            const usedMediaIds = new Set();
            for (const ref of references) {
                try {
                    const records = yield ref.model.findAll({
                        where: { [ref.field]: { [Op.ne]: null } },
                        attributes: [ref.field],
                        raw: true,
                    });
                    for (const record of records) {
                        if (record[ref.field]) {
                            usedMediaIds.add(record[ref.field]);
                        }
                    }
                }
                catch (err) {
                    // Skip models that fail (e.g., table doesn't exist yet)
                }
            }
            // Find orphan IDs
            const orphanIds = allMedias
                .filter(m => !usedMediaIds.has(m.id))
                .map(m => m.id)
                .slice(0, limit);
            if (orphanIds.length === 0)
                return [];
            // Return full Media records
            return yield this.findAll({
                where: { id: { [Op.in]: orphanIds } },
            });
        });
    }
}
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], BaseMedia.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column,
    __metadata("design:type", String)
], BaseMedia.prototype, "key", void 0);
__decorate([
    AllowNull(false),
    Column,
    __metadata("design:type", String)
], BaseMedia.prototype, "real_name", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], BaseMedia.prototype, "folder", void 0);
__decorate([
    AllowNull(false),
    Column,
    __metadata("design:type", String)
], BaseMedia.prototype, "name", void 0);
__decorate([
    AllowNull(false),
    Column,
    __metadata("design:type", String)
], BaseMedia.prototype, "mime_type", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.BIGINT),
    __metadata("design:type", Number)
], BaseMedia.prototype, "file_size", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], BaseMedia.prototype, "file_extension", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", String)
], BaseMedia.prototype, "signed_url", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Object)
], BaseMedia.prototype, "metadata", void 0);
__decorate([
    AllowNull(false),
    Column,
    __metadata("design:type", String)
], BaseMedia.prototype, "visibility", void 0);
__decorate([
    AllowNull(false),
    Default(MediaStatus.PENDING),
    Column,
    __metadata("design:type", String)
], BaseMedia.prototype, "status", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date
    // uploaded_by will be defined in the extending class with @ForeignKey
    )
], BaseMedia.prototype, "expires_at", void 0);
__decorate([
    AllowNull(true),
    Column,
    __metadata("design:type", Date)
], BaseMedia.prototype, "deleted_at", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], BaseMedia.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date)
], BaseMedia.prototype, "updated_at", void 0);
// For backwards compatibility, also export as Media
// Projects should import from their own src/models/Media.ts instead
export { BaseMedia as Media };
