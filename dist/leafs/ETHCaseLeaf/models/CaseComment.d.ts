import { Model } from 'etherial/components/database/provider';
import { type CaseAttachment } from '../services/statuses.js';
/**
 * Base CaseComment (no @Table): a message on a case, from the customer
 * (`resident`) or from staff. A staff message is a reply the customer reads,
 * or an internal note they never see.
 *
 * The project declares the table and adds the foreign keys and associations
 * of `case_id` and `author_user_id`:
 *
 * ```typescript
 * @Table({ timestamps: true, tableName: 'case_comments', freezeTableName: true })
 * export class CaseComment extends BaseCaseComment {
 *     @ForeignKey(() => Case)
 *     declare case_id: number
 *
 *     @BelongsTo(() => Case)
 *     declare case: Case
 * }
 * ```
 */
export declare class BaseCaseComment extends Model<any> {
    id: number;
    case_id: number;
    author_user_id: number;
    author_kind: 'staff' | 'resident';
    /** As the customer reads it: the staff member's first name, or "Customer care". */
    author_name: string;
    body: string;
    /** Between staff: the customer neither sees it nor is told. */
    internal: boolean;
    /** Files staff put on the message (Media rows, by id). */
    attachments: CaseAttachment[];
    created_at: Date;
    updated_at: Date;
    /**
     * A staff reply answers the customer: it starts the "answered" clock and
     * tells them (unless `{ notify: false }`). A customer message puts the
     * case back in the staff's hands and alerts them.
     */
    static commentPosted(comment: BaseCaseComment, options: {
        notify?: boolean;
        transaction?: any;
    }): Promise<void>;
}
