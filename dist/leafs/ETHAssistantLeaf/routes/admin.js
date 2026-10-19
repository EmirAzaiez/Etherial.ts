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
import { Controller, Post } from 'etherial/components/http/provider';
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider';
import { mayUse } from '../services/access.js';
import { AssistantError } from '../services/anthropic.js';
import { ask, parseInput } from '../services/run.js';
let ETHAssistantAdminController = class ETHAssistantAdminController {
    /**
     * POST /admin/assistant/ask
     * { task: 'ask' | 'summarize' | 'draft', messages: [{ role, content }], context?: { collection, id?, filters?, search? }, language?: 'en' | 'ar',
     *   conversationId?, where? }
     * → { answer, steps, model, usage, proposals?, conversationId? }
     *
     * `proposals`: changes prepared for the person to confirm (leaf's `proposals` on).
     * `conversationId`: where the turn was kept (leaf's `history` on); sent back
     * with the next question to carry on the same conversation.
     */
    ask(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!(yield mayUse(req.user)))
                return res.error({ status: 403, errors: ['forbidden'] });
            try {
                const input = parseInput(req.body);
                return res.success({ status: 200, data: yield ask(req.user, input) });
            }
            catch (err) {
                if (err instanceof AssistantError)
                    return res.error({ status: err.status, errors: [err.code], message: err.message });
                console.error('[ETHAssistantLeaf] Request failed:', (err === null || err === void 0 ? void 0 : err.message) || err);
                return res.error({ status: 500, errors: ['assistant_failed'] });
            }
        });
    }
};
__decorate([
    Post('/admin/assistant/ask'),
    ShouldBeAuthenticated(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ETHAssistantAdminController.prototype, "ask", null);
ETHAssistantAdminController = __decorate([
    Controller()
], ETHAssistantAdminController);
export default ETHAssistantAdminController;
