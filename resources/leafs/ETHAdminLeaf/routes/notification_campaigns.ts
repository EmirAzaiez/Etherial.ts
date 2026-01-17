import etherial from 'etherial'
import { Controller, Get, Post, Request, Response, ShouldFindAllFromModel, ShouldFindOneFromModel } from 'etherial/components/http/provider'
import { ShouldBeAuthenticated } from 'etherial/components/http.auth/provider'
import { ShouldValidateYupForm } from 'etherial/components/http/yup.validator'
import { NotificationCampaign } from '../../ETHPulseLeaf/models/NotificationCampaign'
import { Device, DevicePushTokenStatus } from '../../ETHPulseLeaf/models/Device'
import { PushService } from '../../ETHPulseLeaf/services/push.service'
import { CampaignForm, CampaignFormType } from '../forms/campaign_form'
import { Op } from 'sequelize'

@Controller()
export default class ETHAdminNotificationCampaignsController {
    @Get('/admin/campaigns/notifications')
    @ShouldBeAuthenticated()
    @ShouldFindAllFromModel(NotificationCampaign, {
        attributes: ['id', 'message', 'url', 'devices_count', 'target_logged_user', 'target_not_logged_user', 'created_at'],
        defaultOrder: [['created_at', 'DESC']],
        canAccess: async (req: any) => {
            const adminLeaf = (etherial as any).eth_admin_leaf
            return adminLeaf?.checkAccess(req.user, 'campaigns', 'list') ?? false
        }
    })
    list() { }

    @Get('/admin/campaigns/notifications/:id')
    @ShouldBeAuthenticated()
    @ShouldFindOneFromModel(NotificationCampaign, {
        paramName: 'id',
        canAccess: async (req: any) => {
            const adminLeaf = (etherial as any).eth_admin_leaf
            return adminLeaf?.checkAccess(req.user, 'campaigns', 'show') ?? false
        }
    })
    show() { }

    @Post('/admin/campaigns/notifications')
    @ShouldBeAuthenticated()
    @ShouldValidateYupForm(CampaignForm)
    async create(req: Request & { form: CampaignFormType; user: any }, res: Response): Promise<any> {
        const adminLeaf = (etherial as any).eth_admin_leaf

        const hasAccess = await adminLeaf?.checkAccess(req.user, 'campaigns', 'create')
        if (!hasAccess) {
            return res.error?.({ status: 403, errors: ['forbidden'] })
        }

        try {
            const { message, url, data, target_logged_user, target_not_logged_user } = req.form

            // Build notification data
            let notificationData: any = data || {}
            if (url) {
                notificationData.location = 'ExternalLink'
                notificationData.url = url
            }

            // Build device filter
            const whereConditions: any = {
                push_token_status: DevicePushTokenStatus.ENABLED,
                status: true,
            }

            if (target_logged_user && target_not_logged_user) {
                // Both: all devices
            } else if (target_logged_user) {
                whereConditions.user_id = { [Op.ne]: null }
            } else if (target_not_logged_user) {
                whereConditions.user_id = null
            }

            // Find devices
            const devices = await Device.findAll({ where: whereConditions })

            if (devices.length === 0) {
                return res.success?.({
                    status: 200,
                    data: { message: 'No devices found', devices_count: 0 }
                })
            }

            // Create campaign
            const campaign = await NotificationCampaign.create({
                message,
                data: notificationData,
                url: url || null,
                devices_count: devices.length,
                target_logged_user: target_logged_user ?? true,
                target_not_logged_user: target_not_logged_user ?? false,
                created_by_user_id: req.user.id,
            })

            // Send push notifications
            const tokens = devices.map((d: any) => d.push_token).filter(Boolean)
            if (tokens.length > 0) {
                await PushService.sendMultiple(tokens, message, notificationData)
            }

            return res.success?.({
                status: 201,
                data: {
                    campaign_id: campaign.id,
                    devices_count: devices.length,
                    message: 'Campaign created and notifications sent'
                }
            })
        } catch (error: any) {
            console.error('[ETHAdminLeaf] Campaign create error:', error)
            return res.error?.({ status: 500, errors: [error.message] })
        }
    }
}

export const AvailableRouteMethods = ['list', 'show', 'create'] as const
