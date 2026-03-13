var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export class UnifonicProvider {
    constructor(config) {
        this.name = 'unifonic';
        this.baseUrl = 'https://el.cloud.unifonic.com/rest/SMS/messages';
        console.log(config);
        if (!config.appSid || !config.senderId) {
            throw new Error('UnifonicProvider: appSid and senderId are required');
        }
        this.appSid = config.appSid;
        this.senderId = config.senderId;
    }
    send(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.sendWithOptions({ to: params.phone, message: params.message });
        });
    }
    sendBulk(recipients, message) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield Promise.allSettled(recipients.map(recipient => this.send({ phone: recipient, message })));
            return results.map((result, index) => {
                var _a;
                if (result.status === 'fulfilled') {
                    return result.value;
                }
                return {
                    success: false,
                    error: ((_a = result.reason) === null || _a === void 0 ? void 0 : _a.message) || 'Unknown error',
                    provider: this.name,
                    timestamp: new Date(),
                };
            });
        });
    }
    sendWithOptions(options) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Format recipient: remove + or 00 prefix
                const formattedRecipient = options.to.replace(/^(\+|00)/, '');
                const response = yield fetch(this.baseUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        AppSid: this.appSid,
                        SenderID: options.from || this.senderId,
                        Recipient: formattedRecipient,
                        Body: options.message,
                        responseType: 'JSON',
                        baseEncode: true,
                    }),
                });
                const data = yield response.json();
                // Unifonic returns success when status code is 0
                if (data.success === true || data.errorCode === 'ER-00') {
                    return {
                        success: true,
                        messageId: ((_a = data.data) === null || _a === void 0 ? void 0 : _a.MessageID) || data.MessageID,
                        provider: this.name,
                        timestamp: new Date(),
                    };
                }
                return {
                    success: false,
                    error: data.message || data.errorMessage || 'Failed to send SMS',
                    provider: this.name,
                    timestamp: new Date(),
                };
            }
            catch (error) {
                console.error(`[UnifonicProvider] Failed to send SMS to ${options.to}:`, error.message);
                return {
                    success: false,
                    error: error.message || 'Failed to send SMS',
                    provider: this.name,
                    timestamp: new Date(),
                };
            }
        });
    }
}
