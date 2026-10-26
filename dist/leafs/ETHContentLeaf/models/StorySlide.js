var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
import { Table, Column, Model, AllowNull, PrimaryKey, AutoIncrement, DataType, Default, ForeignKey, BelongsTo, BeforeSave } from 'etherial/components/database/provider';
import { labelOf } from '../services/options.js';
import { languages } from '../services/state.js';
import { cleanTexts, orNull } from '../services/texts.js';
import { Story } from './Story.js';
/** One full-screen slide of a story, written in the story's form. `image` is the project's media row. */
let StorySlide = class StorySlide extends Model {
    static check(slide) {
        slide.title = cleanTexts(slide.title);
        slide.text = cleanTexts(slide.text);
        slide.button = cleanTexts(slide.button);
        slide.label = labelOf(slide.title, languages().default);
        slide.link = orNull(slide.link);
        slide.duration = Math.min(Math.max(Math.round(Number(slide.duration) || 5), 2), 30);
    }
};
__decorate([
    AutoIncrement,
    PrimaryKey,
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StorySlide.prototype, "id", void 0);
__decorate([
    ForeignKey(() => Story),
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StorySlide.prototype, "story_id", void 0);
__decorate([
    BelongsTo(() => Story, { foreignKey: 'story_id', onDelete: 'CASCADE' }),
    __metadata("design:type", Function)
], StorySlide.prototype, "story", void 0);
__decorate([
    AllowNull(false),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StorySlide.prototype, "image_id", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], StorySlide.prototype, "title", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], StorySlide.prototype, "text", void 0);
__decorate([
    AllowNull(false),
    Default({}),
    Column(DataType.JSONB),
    __metadata("design:type", Object)
], StorySlide.prototype, "button", void 0);
__decorate([
    AllowNull(true),
    Column(DataType.STRING(500)),
    __metadata("design:type", String)
], StorySlide.prototype, "link", void 0);
__decorate([
    AllowNull(false),
    Default(5),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StorySlide.prototype, "duration", void 0);
__decorate([
    AllowNull(false),
    Default(''),
    Column(DataType.STRING(200)),
    __metadata("design:type", String)
], StorySlide.prototype, "label", void 0);
__decorate([
    AllowNull(false),
    Default(0),
    Column(DataType.INTEGER),
    __metadata("design:type", Number)
], StorySlide.prototype, "position", void 0);
__decorate([
    BeforeSave,
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [StorySlide]),
    __metadata("design:returntype", void 0)
], StorySlide, "check", null);
StorySlide = __decorate([
    Table({
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        tableName: 'content_story_slides',
        freezeTableName: true,
        indexes: [{ fields: ['story_id', 'position'] }],
    })
], StorySlide);
export { StorySlide };
