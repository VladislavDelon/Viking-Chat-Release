import { useMemo } from 'react'
import { getSeason, SEASON_META } from '../lib/season'

/** Falling seasonal particles (leaves in autumn, snow in winter, …). */
export function SeasonalFx({ count = 26 }: { count?: number }) {
  const season = getSeason()
  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 14,
        dur: 8 + Math.random() * 11,
        size: 10 + Math.random() * 18,
        opacity: 0.25 + Math.random() * 0.55,
        char:
          SEASON_META[season].particles[
            Math.floor(Math.random() * SEASON_META[season].particles.length)
          ],
      })),
    [count, season],
  )

  return (
    <>
      {particles.map(p => (
        <span
          key={p.id}
          className="flake"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            fontSize: p.size,
            opacity: p.opacity,
          }}
        >
          {p.char}
        </span>
      ))}
    </>
  )
}
