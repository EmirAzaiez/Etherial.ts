import { bookingModels, state, timezoneOf, type BookingNoticeKind } from './options.js'

/**
 * Tells the customer through the project's `notify`, in the background: a
 * notification is a comfort, its failure must not fail the appointment's write.
 */
export function notifyCustomer(appointment: any, kind: BookingNoticeKind): void {
    const notify = state.config.notify
    if (!notify || !appointment?.user_id) return

    ;(async () => {
        const scheduler = appointment.scheduler ?? (await bookingModels().Scheduler.findByPk(appointment.scheduler_id, { attributes: ['id', 'timezone'] }))
        await notify({ kind, appointment, timezone: timezoneOf(scheduler) })
    })().catch((error) => console.error(`[ETHBookingLeaf] Could not tell the customer of appointment #${appointment.id} (${kind}):`, error?.message || error))
}

/** "Tue, Sep 29, 10:00" in the given zone: the scheduler's, not the server's nor the phone's. */
export function formatAppointmentTime(date: Date | string, timezone: string, locale = 'en-US'): string {
    return new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
    }).format(new Date(date))
}
