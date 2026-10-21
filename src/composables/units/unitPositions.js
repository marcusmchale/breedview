import { periodStart, periodEnd } from '@/composables/parsers/partialDatetime'

/*
 * Where units are over time (breedgraph README, Unit graph). A position holds from the start of its start's period to
 * the end of its end's, a missing start or end leaving it open, so a move at T (one position ending at T, the next
 * starting at T) has both holding during T: the later-starting one is where the unit is. A unit without a position of
 * its own at a time is where its parent is, and a position that ended with nothing after it means the unit left.
 */

const byNumber = (a, b) => (a === b ? 0 : a < b ? -1 : 1)

/** The order the API lists positions in: by start, those without one first, then by end, those without one last */
export const comparePositions = (a, b) =>
  byNumber(periodStart(a.start) ?? -Infinity, periodStart(b.start) ?? -Infinity) ||
  byNumber(periodEnd(a.end) ?? Infinity, periodEnd(b.end) ?? Infinity)

export const sortPositions = (positions) => [...(positions ?? [])].sort(comparePositions)

const pad = (n) => String(n).padStart(2, '0')

/** Today by the browser's clock, to the day: positions are local wall-clock times without a zone */
export const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Whether a position holds at a time, the time standing for its period (a month overlaps the days in it) */
export const holdsAt = (position, time) => {
  const from = periodStart(time)
  if (from == null) return false
  const to = periodEnd(time)
  return (periodStart(position.start) ?? -Infinity) < to && from < (periodEnd(position.end) ?? Infinity)
}

/** The position holding at a time: of those that do, the later-starting, then the later-ending; or null */
export const positionAt = (positions, time) => sortPositions(positions).filter((p) => holdsAt(p, time)).at(-1) ?? null

/**
 * The unit's own position now, as { position, ended }: the one holding today, else the last one started, which has
 * ended; null without positions, or with only positions that start later
 */
export const currentPosition = (positions, now = today()) => {
  const holding = positionAt(positions, now)
  if (holding) return { position: holding, ended: false }
  const nowEnds = periodEnd(now)
  const started = sortPositions(positions).filter((p) => (periodStart(p.start) ?? -Infinity) < nowEnds)
  return started.length ? { position: started.at(-1), ended: true } : null
}

/**
 * Where a unit was at a time: its own position holding then, else that of the nearest unit above it holding then;
 * without a time, or with none holding, the latest position of the nearest unit that has any.
 * units: the unit, then the units above it, closest first (Unit.ancestors)
 */
export const placeAt = (units, time) => {
  const chain = (units ?? []).filter(Boolean)
  if (time) {
    for (const unit of chain) {
      const position = positionAt(unit.positions, time)
      if (position) return position
    }
  }
  const positioned = chain.find((unit) => unit.positions?.length)
  return positioned ? sortPositions(positioned.positions).at(-1) : null
}
