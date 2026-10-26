var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, HasMany, BeforeSave } from 'etherial/components/database/provider';
import { AUDIENCES, ContentError } from '../services/options.js';
import { cleanTexts, requiredLabel } from '../services/texts.js';
import { StorySlide } from './StorySlide.js';
/**
 * A bubble of the home screen and the full-screen slides behind it.
 * `cover` is the project's media row (an association the leaf adds at boot).
 */
let Story = class Story extends Model {
    static check(story) {
        story.title = cleanTexts(story.title);
        story.label = requiredLabel(story.title, 'Title');
        if (!AUDIENCES.includes(story.audience))
            throw new ContentError(`Audience: one of ${AUDIENCES.join(', ')}.`);
        if (story.starts_at && story.ends_at && new Date(story.ends_at) <= new Date(story.starts_at)) {
            throw new ContentError('The end must come after the start.');
        }
        if (story.published && !story.published_at)
            story.published_at = new Date();
    }
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], Story.prototype, "id", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], Story.prototype, "title", void 0);
__decorate([
    AllowNull(false),
    Default(''),
    Column(DataType.STRING(200)),
    __metadata("design:type", String)
], Story.prototype, "label", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], Story.prototype, "cover_id", void 0);
__decorate([
    AllowNull(false),
    Default('everyone'),
    Column(DataType.STRING(20)),
    __metadata("design:type", String)
], Story.prototype, "audience", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], Story.prototype, "starts_at", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], Story.prototype, "ends_at", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], Story.prototype, "position", void 0);
__decorate([
    AllowNull(false),
    Default(false),
    Column(DataType.BOOLEAN),
    __metadata("design:type", Boolean)
], Story.prototype, "published", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.DATE),
    __metadata("design:type", Date)
], Story.prototype, "published_at", void 0);
__decorate([
    HasMany(() => StorySlide, { foreignKey: 'story_id', onDelete: 'CASCADE' }),
    __metadata("design:type", Array)
], Story.prototype, "slides", void 0);
__decorate([
    BeforeSave,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Story]),
    __metadata("design:returntype", void 0)
], Story, "check", null);
Story = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'content_stories',
        freezeTableName: true,
        indexes: [{ fields: ['published', 'position'] }],
    })
], Story);
export { Story };
