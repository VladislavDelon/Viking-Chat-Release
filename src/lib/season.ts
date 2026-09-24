export type Season = 'winter' | 'spring' | 'summer' | 'autumn'

/** Northern-hemisphere meteorological seasons. */
export function getSeason(d = new Date()): Season {
  const m = d.getMonth()
  if (m >= 2 && m <= 4) return 'spring'
  if (m >= 5 && m <= 7) return 'summer'
  if (m >= 8 && m <= 10) return 'autumn'
  return 'winter'
}

export const SEASON_META: Record<
  Season,
  { label: string; particles: string[]; big: string }
> = {
  winter: { label: 'Зима', particles: ['❄', '❅', '❆'], big: '❄️' },
  spring: { label: 'Весна', particles: ['🌸', '🌷', '💮'], big: '🌸' },
  summer: { label: 'Лето', particles: ['✨', '🍃', '🌿'], big: '☀️' },
  autumn: { label: 'Осень', particles: ['🍂', '🍁', '🌰'], big: '🍂' },
}
