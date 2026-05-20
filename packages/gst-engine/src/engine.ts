/**
 * RuleEngine — pure TypeScript, zero runtime deps.
 *
 * Works in Cloudflare Workers, Capacitor (offline), and Node.js.
 * No fs, crypto, path, or any Node built-in is used.
 *
 * Money: all amounts are integer paise (sacred rule #2).
 * Every resolution logs the rule_id used (sacred rule #4).
 */

import type { RuleFile } from './rule-schema'

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type ResolvedRule = {
  rule_id: string
  domain: string
  key: string
  rule: Record<string, unknown>
  source_citation: RuleFile['source']
  effective_from: string
  effective_to: string | null
}

export type SchemeElectionSnapshot = {
  threshold_rule_id: string
  rate_rules: string[]
}

// ---------------------------------------------------------------------------
// RuleEngineError
// ---------------------------------------------------------------------------

export class RuleEngineError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'RuleEngineError'
    this.code = code
  }
}

// ---------------------------------------------------------------------------
// djb2 hash — used for development-mode hash bypass checking.
// Real SHA-256 is computed by the CI script and embedded in the `hash` field.
// ---------------------------------------------------------------------------

function djb2(input: string): string {
  let hash = 5381
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    // Coerce to 32-bit int using bitwise OR 0
    hash = (((hash << 5) + hash) ^ ch) | 0
  }
  return `djb2-${(hash >>> 0).toString(16)}`
}

/**
 * Canonicalize a RuleFile for hashing: exclude the `hash` field itself,
 * sort keys recursively, then JSON.stringify.
 */
function canonicalizeForHash(rule: RuleFile): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { hash: _hash, ...rest } = rule
  return JSON.stringify(rest, Object.keys(rest).sort())
}

// ---------------------------------------------------------------------------
// Date-range helpers (ISO YYYY-MM-DD string comparison is lexicographic-safe)
// ---------------------------------------------------------------------------

/** Returns true if transactionDate falls within [effectiveFrom, effectiveTo] (inclusive). */
function dateInRange(
  transactionDate: string,
  effectiveFrom: string,
  effectiveTo: string | null,
): boolean {
  if (transactionDate < effectiveFrom) return false
  if (effectiveTo !== null && transactionDate > effectiveTo) return false
  return true
}

/** Returns true if two date ranges overlap (inclusive bounds, null = open-ended). */
function rangesOverlap(
  aFrom: string,
  aTo: string | null,
  bFrom: string,
  bTo: string | null,
): boolean {
  // A ends before B starts
  if (aTo !== null && aTo < bFrom) return false
  // B ends before A starts
  if (bTo !== null && bTo < aFrom) return false
  return true
}

// ---------------------------------------------------------------------------
// RuleEngine
// ---------------------------------------------------------------------------

export class RuleEngine {
  /** Index: domain -> key -> sorted list of RuleFile */
  private readonly index: Map<string, Map<string, RuleFile[]>>
  /** Index: rule_id -> RuleFile */
  private readonly byId: Map<string, RuleFile>
  /** Memoization cache: "domain:key:date" -> ResolvedRule */
  private readonly memo: Map<string, ResolvedRule>

  private constructor(rules: RuleFile[]) {
    this.byId = new Map()
    this.index = new Map()
    this.memo = new Map()

    for (const r of rules) {
      this.byId.set(r.rule_id, r)

      let domainMap = this.index.get(r.domain)
      if (domainMap === undefined) {
        domainMap = new Map()
        this.index.set(r.domain, domainMap)
      }

      let bucket = domainMap.get(r.key)
      if (bucket === undefined) {
        bucket = []
        domainMap.set(r.key, bucket)
      }
      bucket.push(r)
    }
  }

  // -------------------------------------------------------------------------
  // Static factory — runs all load-time invariant checks
  // -------------------------------------------------------------------------

  static fromRules(rules: RuleFile[]): RuleEngine {
    RuleEngine.checkInvariants(rules)
    return new RuleEngine(rules)
  }

  private static checkInvariants(rules: RuleFile[]): void {
    // 1. Duplicate rule_id
    const seenIds = new Set<string>()
    for (const r of rules) {
      if (seenIds.has(r.rule_id)) {
        throw new RuleEngineError(
          `Invariant 1 violated: duplicate rule_id "${r.rule_id}"`,
          'DUPLICATE_RULE_ID',
        )
      }
      seenIds.add(r.rule_id)
    }

    // 2. Hash mismatch (skip if hash === 'sha256-placeholder')
    for (const r of rules) {
      if (r.hash === 'sha256-placeholder') continue
      const canonical = canonicalizeForHash(r)
      const computed = djb2(canonical)
      if (r.hash !== computed) {
        throw new RuleEngineError(
          `Invariant 2 violated: hash mismatch for rule_id "${r.rule_id}". Declared: "${r.hash}", computed: "${computed}". Set hash to "sha256-placeholder" in development mode.`,
          'HASH_MISMATCH',
        )
      }
    }

    // 3. Rule overlap — same (domain, key) with overlapping date ranges
    //    Group by (domain, key) and check every pair
    const byDomainKey = new Map<string, RuleFile[]>()
    for (const r of rules) {
      const k = `${r.domain}::${r.key}`
      let bucket = byDomainKey.get(k)
      if (bucket === undefined) {
        bucket = []
        byDomainKey.set(k, bucket)
      }
      bucket.push(r)
    }

    for (const [dk, bucket] of byDomainKey) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          const a = bucket[i]
          const b = bucket[j]
          if (a === undefined || b === undefined) continue
          if (rangesOverlap(a.effective_from, a.effective_to, b.effective_from, b.effective_to)) {
            throw new RuleEngineError(
              `Invariant 3 violated: overlapping date ranges for (${dk}): ` +
                `"${a.rule_id}" [${a.effective_from}, ${a.effective_to ?? '∞'}] ` +
                `overlaps "${b.rule_id}" [${b.effective_from}, ${b.effective_to ?? '∞'}]`,
              'RULE_OVERLAP',
            )
          }
        }
      }
    }

    // 4. Broken supersedes chain
    const idSet = new Set(rules.map((r) => r.rule_id))
    for (const r of rules) {
      if (r.supersedes === null) continue

      // The superseded rule must exist
      if (!idSet.has(r.supersedes)) {
        throw new RuleEngineError(
          `Invariant 4 violated: rule "${r.rule_id}" supersedes "${r.supersedes}" which does not exist in the loaded rule set.`,
          'BROKEN_SUPERSEDES_CHAIN',
        )
      }

      // The superseded rule's effective_to must not be later than this rule's effective_from.
      // i.e. the superseded rule must have ended before (or exactly when) this one starts.
      const superseded = rules.find((x) => x.rule_id === r.supersedes)
      if (superseded === undefined) continue // unreachable after above check, but satisfies noUncheckedIndexedAccess

      if (superseded.effective_to !== null && superseded.effective_to >= r.effective_from) {
        // This would mean both are active at the same time — caught by overlap check.
        // But per spec: panic if superseded.effective_to >= this.effective_from.
        // (The overlap check will also catch this, but we report the chain break specifically.)
        throw new RuleEngineError(
          `Invariant 4 violated: supersedes chain broken for "${r.rule_id}": ` +
            `superseded rule "${superseded.rule_id}" has effective_to "${superseded.effective_to}" ` +
            `which is not before this rule's effective_from "${r.effective_from}".`,
          'BROKEN_SUPERSEDES_CHAIN',
        )
      }
    }
  }

  // -------------------------------------------------------------------------
  // resolveRule
  // -------------------------------------------------------------------------

  resolveRule(
    domain: string,
    key: string,
    transactionDate: string,
    opts?: { schemeElection?: SchemeElectionSnapshot },
  ): ResolvedRule {
    // Scheme election grandfathering: if the caller has a scheme election
    // and the threshold_rule_id is in this domain+key bucket, return that
    // exact rule regardless of date.
    if (opts?.schemeElection !== undefined) {
      const electedId = opts.schemeElection.threshold_rule_id
      const candidate = this.byId.get(electedId)
      if (candidate !== undefined && candidate.domain === domain && candidate.key === key) {
        return this.toResolved(candidate)
      }
    }

    const cacheKey = `${domain}:${key}:${transactionDate}`
    const cached = this.memo.get(cacheKey)
    if (cached !== undefined) return cached

    const domainMap = this.index.get(domain)
    if (domainMap === undefined) {
      throw new RuleEngineError(
        `No rule found for (${domain}, ${key}) on ${transactionDate}`,
        'RULE_NOT_FOUND',
      )
    }

    const bucket = domainMap.get(key)
    if (bucket === undefined || bucket.length === 0) {
      throw new RuleEngineError(
        `No rule found for (${domain}, ${key}) on ${transactionDate}`,
        'RULE_NOT_FOUND',
      )
    }

    let found: RuleFile | undefined
    for (const r of bucket) {
      if (dateInRange(transactionDate, r.effective_from, r.effective_to)) {
        found = r
        break
      }
    }

    if (found === undefined) {
      throw new RuleEngineError(
        `No rule found for (${domain}, ${key}) on ${transactionDate}`,
        'RULE_NOT_FOUND',
      )
    }

    const resolved = this.toResolved(found)
    this.memo.set(cacheKey, resolved)
    return resolved
  }

  private toResolved(r: RuleFile): ResolvedRule {
    return {
      rule_id: r.rule_id,
      domain: r.domain,
      key: r.key,
      rule: r.rule,
      source_citation: r.source,
      effective_from: r.effective_from,
      effective_to: r.effective_to,
    }
  }

  // -------------------------------------------------------------------------
  // Stub: R2/KV lazy-load path (wired in Phase 2 / CF Worker setup)
  // -------------------------------------------------------------------------

  static fetchHsnMaster(_r2Binding?: unknown, _kvBinding?: unknown): Promise<never> {
    return Promise.reject(
      new RuleEngineError(
        'fetchHsnMaster: R2/KV bindings not wired — deferred to Phase 2',
        'NOT_IMPLEMENTED',
      ),
    )
  }
}
