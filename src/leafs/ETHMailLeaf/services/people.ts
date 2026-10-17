import { MailTemplate } from '../models/MailTemplate.js'

/**
 * Who saved a version, scheduled a campaign: names for the back-office, read
 * from the project's `User` model with the columns it has. An id it can't
 * name stays out of the map.
 */
export async function peopleNames(ids: (number | null | undefined)[]): Promise<Map<number, string>> {
    const names = new Map<number, string>()
    const unique = [...new Set(ids.filter((id): id is number => typeof id === 'number'))]
    const User = (MailTemplate as any).sequelize?.models?.User
    if (!unique.length || !User) return names

    const columns = ['first_name', 'last_name', 'firstname', 'lastname', 'name', 'email'].filter((c) => c in (User.rawAttributes ?? {}))
    try {
        const rows = await User.findAll({ where: { id: unique }, attributes: ['id', ...columns], raw: true })
        for (const row of rows) {
            const full = [row.first_name ?? row.firstname, row.last_name ?? row.lastname].filter(Boolean).join(' ').trim()
            const label = full || row.name || row.email
            if (label) names.set(row.id, String(label))
        }
    } catch (err: any) {
        console.error('[ETHMailLeaf] Could not read the users’ names:', err?.message || err)
    }
    return names
}

/** `{ id, name }`, or null without an id. */
export function person(id: number | null | undefined, names: Map<number, string>) {
    return typeof id === 'number' ? { id, name: names.get(id) ?? null } : null
}
