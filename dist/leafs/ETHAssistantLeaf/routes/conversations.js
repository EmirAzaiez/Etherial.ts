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
import { Controller, Delete, Get, Post, Put } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { mayUse } from '../services/access.js';
import { DECISIONS, deleteConversation, getConversation, listConversations, recordDecision, renameConversation } from '../services/history.js';
import { aiAllowed } from '../services/options.js';
/** Mounted only with the leaf's `history` on. Each person reaches their own conversations, never another's. */
function refused(req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!aiAllowed()) {
            ;
            res.error({ status: 503, errors: ['ai_off'] });
            return true;
        }
        if (!(yield mayUse(req.user))) {
            ;
            res.error({ status: 403, errors: ['forbidden'] });
            return true;
        }
        return false;
    });
}
const notFound = (res) => res.error({ status: 404, errors: ['not_found'] });
let ETHAssistantConversationsController = class ETHAssistantConversationsController {
    /** GET /admin/assistant/conversations?q= → { items: [{ id, title, turns, created_at, updated_at }] }, latest first */
    list(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield refused(req, res))
                return;
            const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
            return res.success({ status: 200, data: { items: yield listConversations(req.user.id, q || undefined) } });
        });
    }
    /** GET /admin/assistant/conversations/:id → { id, title, turns, created_at, updated_at } */
    show(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield refused(req, res))
                return;
            const conversation = yield getConversation(req.user.id, req.params.id);
            if (!conversation)
                return notFound(res);
            return res.success({ status: 200, data: conversation });
        });
    }
    /** PUT /admin/assistant/conversations/:id { title } */
    rename(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (yield refused(req, res))
                return;
            const title = typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.title) === 'string' ? req.body.title.trim().replace(/\s+/g, ' ') : '';
            if (!title)
                return res.error({ status: 400, errors: ['title_missing'] });
            if (!(yield renameConversation(req.user.id, req.params.id, title)))
                return notFound(res);
            return res.success({ status: 200, data: { id: Number(req.params.id), title: title.slice(0, 200) } });
        });
    }
    /** DELETE /admin/assistant/conversations/:id */
    remove(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield refused(req, res))
                return;
            if (!(yield deleteConversation(req.user.id, req.params.id)))
                return notFound(res);
            return res.success({ status: 200, data: { deleted: true } });
        });
    }
    /**
     * POST /admin/assistant/conversations/:id/decisions
     * { proposal, status: 'confirmed' | 'cancelled' | 'failed', error?, createdId? }
     *
     * Only a note on the card, for the conversation to show it when reopened:
     * the change itself went through the back-office's own endpoint.
     */
    decide(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            if (yield refused(req, res))
                return;
            const proposal = typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.proposal) === 'string' ? req.body.proposal.slice(0, 64) : '';
            const status = (_b = req.body) === null || _b === void 0 ? void 0 : _b.status;
            if (!proposal || !DECISIONS.includes(status))
                return res.error({ status: 400, errors: ['decision_invalid'] });
            const createdId = typeof ((_c = req.body) === null || _c === void 0 ? void 0 : _c.createdId) === 'string' || typeof ((_d = req.body) === null || _d === void 0 ? void 0 : _d.createdId) === 'number' ? req.body.createdId : undefined;
            const error = typeof ((_e = req.body) === null || _e === void 0 ? void 0 : _e.error) === 'string' ? req.body.error : undefined;
            if (!(yield recordDecision(req.user.id, req.params.id, proposal, { status, error, createdId })))
                return notFound(res);
            return res.success({ status: 200, data: { recorded: true } });
        });
    }
};
__decorate([
    Get('/admin/assistant/conversations'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAssistantConversationsController.prototype, "list", null);
__decorate([
    Get('/admin/assistant/conversations/:id(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAssistantConversationsController.prototype, "show", null);
__decorate([
    Put('/admin/assistant/conversations/:id(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAssistantConversationsController.prototype, "rename", null);
__decorate([
    Delete('/admin/assistant/conversations/:id(\\d+)'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAssistantConversationsController.prototype, "remove", null);
__decorate([
    Post('/admin/assistant/conversations/:id(\\d+)/decisions'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAssistantConversationsController.prototype, "decide", null);
ETHAssistantConversationsController = __decorate([
    Controller()
], ETHAssistantConversationsController);
export default ETHAssistantConversationsController;
