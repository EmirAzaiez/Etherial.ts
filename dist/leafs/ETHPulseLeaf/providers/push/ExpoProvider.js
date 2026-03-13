var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Expo } from 'expo-server-sdk';
export class ExpoProvider {
    constructor(config = {}) {
        this.name = 'expo';
        this.expo = new Expo({
            accessToken: config.accessToken,
        });
    }
    send(pushToken, message, options) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = yield this.sendMultiple([pushToken], message, options);
            return results[0];
        });
    }
    sendMultiple(pushTokens, message, options) {
        return __awaiter(this, void 0, void 0, function* () {
            // Filter valid Expo push tokens
            const validTokens = pushTokens.filter(token => Expo.isExpoPushToken(token));
            if (validTokens.length === 0) {
                return pushTokens.map(() => ({
                    success: false,
                    error: 'Invalid Expo push token',
                }));
            }
            const messages = validTokens.map(token => ({
                to: token,
                sound: message.sound || 'default',
                title: message.title,
                body: message.body,
                data: message.data,
                badge: message.badge,
                channelId: message.channelId,
                priority: options === null || options === void 0 ? void 0 : options.priority,
                ttl: options === null || options === void 0 ? void 0 : options.ttl,
            }));
            const results = [];
            const chunks = this.expo.chunkPushNotifications(messages);
            for (const chunk of chunks) {
                try {
                    const tickets = yield this.expo.sendPushNotificationsAsync(chunk);
                    for (const ticket of tickets) {
                        if (ticket.status === 'ok') {
                            results.push({
                                success: true,
                                ticketId: ticket.id,
                            });
                        }
                        else {
                            results.push({
                                success: false,
                                error: ticket.message,
                            });
                        }
                    }
                }
                catch (error) {
                    // If the whole chunk fails, mark all as failed
                    chunk.forEach(() => {
                        results.push({
                            success: false,
                            error: error.message || 'Failed to send push notification',
                        });
                    });
                }
            }
            return results;
        });
    }
    /**
     * Check receipts for previously sent notifications
     */
    checkReceipts(ticketIds) {
        return __awaiter(this, void 0, void 0, function* () {
            const receiptResults = new Map();
            const receiptIdChunks = this.expo.chunkPushNotificationReceiptIds(ticketIds);
            for (const chunk of receiptIdChunks) {
                try {
                    const receipts = yield this.expo.getPushNotificationReceiptsAsync(chunk);
                    for (const [receiptId, receipt] of Object.entries(receipts)) {
                        const r = receipt;
                        if (r.status === 'ok') {
                            receiptResults.set(receiptId, { status: 'ok' });
                        }
                        else if (r.status === 'error') {
                            receiptResults.set(receiptId, {
                                status: 'error',
                                error: r.message,
                            });
                        }
                    }
                }
                catch (error) {
                    chunk.forEach(id => {
                        receiptResults.set(id, {
                            status: 'error',
                            error: error.message,
                        });
                    });
                }
            }
            return receiptResults;
        });
    }
}
