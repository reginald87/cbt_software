'use client'

import { useAuth } from '@/contexts/AuthContext'
import { GraduationCap, Building2, Sparkles, Trophy, User } from 'lucide-react'

type Variant = 'hero' | 'compact' | 'success' | 'neutral'

interface StudentEncouragementProps {
  variant?: Variant
  heading?: string
  message?: string
  className?: string
}

const MESSAGES: Record<Variant, string> = {
  hero: 'You have what it takes to excel. Stay focused, manage your time wisely, and give every question your very best.',
  compact: "You've got this! Stay calm, read carefully, and trust your preparation.",
  success: 'Outstanding performance! Your dedication and hard work have paid off. Keep aiming higher!',
  neutral: 'Every attempt is a valuable step forward. Review your answers, learn from them, and come back even stronger.',
}

export default function StudentEncouragement({
  variant = 'hero',
  heading,
  message,
  className = '',
}: StudentEncouragementProps) {
  const { user } = useAuth()

  const firstName = user?.first_name?.trim() || user?.last_name?.trim() || user?.username || 'Champion'
  const fullName = `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'Student'
  const identifier = user?.matric_number || user?.jamb_number || ''
  const department = user?.department || ''

  const defaultHeading =
    variant === 'success'
      ? `Congratulations, ${firstName}!`
      : variant === 'compact'
        ? `Good luck, ${firstName}!`
        : variant === 'neutral'
          ? `Great effort, ${firstName}!`
          : `Welcome back, ${firstName}!`

  const title = heading ?? defaultHeading
  const text = message ?? MESSAGES[variant]
  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  const renderAvatar = (wrapper: string, textCls: string) => (
    <div className={`flex items-center justify-center shrink-0 overflow-hidden ${wrapper}`}>
      {user?.profile_picture ? (
        <img src={user.profile_picture} alt={fullName} className="w-full h-full object-cover" />
      ) : (
        <span className={`font-bold ${textCls}`}>{initials || <User className="w-5 h-5" />}</span>
      )}
    </div>
  )

  if (variant === 'hero' || variant === 'success') {
    const isSuccess = variant === 'success'
    const gradient = isSuccess
      ? 'from-success-700 via-success-600 to-success-500'
      : 'from-primary-800 via-primary-700 to-primary-600'
    return (
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${gradient} text-white shadow-lg ${className}`}>
        <div className="absolute -top-14 -right-14 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 right-28 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 min-w-0">
            {renderAvatar('h-12 w-12 rounded-xl bg-white/15 ring-2 ring-white/30 text-white', 'text-lg text-white')}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-white/80 text-[10px] font-semibold uppercase tracking-widest">
                {isSuccess ? <Trophy className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                {isSuccess ? 'Excellent work' : 'Your student portal'}
              </div>
              <h2 className="text-lg md:text-xl font-bold truncate">{title}</h2>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-white/85">
                {identifier && (
                  <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-white bg-white/10 px-2 py-0.5 rounded-md">
                    <GraduationCap className="w-3.5 h-3.5" />
                    {identifier}
                  </span>
                )}
                {department && (
                  <span className="inline-flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {department}
                  </span>
                )}
              </div>
            </div>
          </div>
          <p className="sm:ml-auto sm:max-w-sm text-sm text-white/85 leading-relaxed">{text}</p>
        </div>
      </div>
    )
  }

  if (variant === 'compact') {
    return (
      <div className={`rounded-xl border border-primary-200 bg-primary-50 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 ${className}`}>
        <div className="flex items-center gap-3 min-w-0">
          {renderAvatar('h-10 w-10 rounded-xl bg-primary-600 ring-2 ring-primary-100 text-white', 'text-sm text-white')}
          <div className="min-w-0">
            <div className="text-sm font-semibold text-primary-900 truncate">{title}</div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-primary-700">
              {identifier && (
                <span className="inline-flex items-center gap-1 font-mono font-semibold">
                  <GraduationCap className="w-3 h-3" />
                  {identifier}
                </span>
              )}
              {department && (
                <span className="inline-flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {department}
                </span>
              )}
            </div>
          </div>
        </div>
        <p className="sm:ml-auto sm:max-w-md text-xs text-primary-800 leading-relaxed">{text}</p>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border border-slate-200 bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 shadow-sm ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {renderAvatar('h-10 w-10 rounded-xl bg-slate-100 ring-2 ring-slate-100 text-slate-600', 'text-sm text-slate-700')}
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{title}</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
            {identifier && (
              <span className="inline-flex items-center gap-1 font-mono font-semibold">
                <GraduationCap className="w-3 h-3" />
                {identifier}
              </span>
            )}
            {department && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                {department}
              </span>
            )}
          </div>
        </div>
      </div>
      <p className="sm:ml-auto sm:max-w-md text-xs text-slate-600 leading-relaxed">{text}</p>
    </div>
  )
}
