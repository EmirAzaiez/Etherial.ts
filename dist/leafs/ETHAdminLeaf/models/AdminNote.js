var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, CreatedAt, UpdatedAt, DeletedAt, DataType, Index, } from 'etherial/components/database/provider';
/**
 * An internal note left by staff on a record, never shown to the record's own
 * user.
 *
 * Keyed by collection and record id rather than by model, so a note follows the
 * screen people wrote it on. Paranoid: a note deleted by mistake can be brought
 * back from the database, and a mention notification pointing at it still has
 * something to explain it.
 */
let AdminNote = class AdminNote extends Model {
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    AllowNull(false),
    Column,
    __metadata("design:type", Number)
], AdminNote.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING),
    __metadata("design:type", String)
], AdminNote.prototype, "collection", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.STRING),
    __metadata("design:type", String)
], AdminNote.prototype, "record_id", void 0);
__decorate([
    AllowNull(false),
    Index,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], AdminNote.prototype, "author_id", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.TEXT),
    __metadata("design:type", String)
], AdminNote.prototype, "body", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.JSON),
    __metadata("design:type", Array)
], AdminNote.prototype, "mentions", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], AdminNote.prototype, "edited_at", void 0);
__decorate([
    CreatedAt,
    __metadata("design:type", Date)
], AdminNote.prototype, "created_at", void 0);
__decorate([
    UpdatedAt,
    __metadata("design:type", Date)
], AdminNote.prototype, "updated_at", void 0);
__decorate([
    DeletedAt,
    __metadata("design:type", Date)
], AdminNote.prototype, "deleted_at", void 0);
AdminNote = __decorate([
    Table({
        timestamps: true,
        paranoid: true,
        tableName: 'admin_notes',
        freezeTableName: true,
        indexes: [{ fields: ['collection', 'record_id', 'id'] }],
    })
], AdminNote);
export { AdminNote };
