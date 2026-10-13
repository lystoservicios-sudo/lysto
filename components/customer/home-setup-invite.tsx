'use client'

import { useEffect, useState } from 'react'
import { AirVent, ArrowRight, HousePlus } from 'lucide-react'
import Link from 'next/link'

import type { CustomerHomeViewModel } from '@/features/customer/home-view-model'
import styles from './customer-home.module.css'

type SetupInvite = NonNullable<CustomerHomeViewModel['setupInvite']>

export function HomeSetupInvite({
  invite,
  preferenceScope
}: {
  invite: SetupInvite
  preferenceScope: string
}) {
  const [visible, setVisible] = useState(false)
  const key = `lysto:home-invite:${preferenceScope}:${invite.kind}`

  useEffect(() => {
    setVisible(false)
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? 'null') as {
        deferUntil?: number
      } | null
      setVisible(!stored?.deferUntil || stored.deferUntil <= Date.now())
    } catch {
      setVisible(true)
    }
  }, [key])

  if (!visible) return null
  const Icon = invite.kind === 'address' ? HousePlus : AirVent

  function defer() {
    const deferUntil = Date.now() + invite.deferDays * 24 * 60 * 60 * 1000
    try {
      localStorage.setItem(key, JSON.stringify({ deferUntil }))
    } finally {
      setVisible(false)
    }
  }

  return (
    <aside className={styles.invite}>
      <Icon aria-hidden="true" size={22} strokeWidth={1.6} className={styles.inviteIcon} />
      <div className={styles.inviteCopy}>
        <h2 className={styles.inviteTitle}>{invite.title}</h2>
        <p className={styles.description}>{invite.description}</p>
        <div className={styles.inviteActions}>
          <Link href={invite.action.href} className={styles.activityAction}>
            {invite.action.label}<ArrowRight aria-hidden="true" size={15} />
          </Link>
          <button type="button" className={styles.secondaryAction} onClick={defer}>
            Ahora no
          </button>
        </div>
      </div>
    </aside>
  )
}
