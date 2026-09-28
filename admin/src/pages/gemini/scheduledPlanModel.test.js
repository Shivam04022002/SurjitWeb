// The saved monthly plan, as the page reads it.
//
// The counts, the state names and what the browser sends when it saves a plan
// are what these pin down. Whether a row generates is the server's business and
// is covered by the backend suite; what matters here is that the page never
// invents state of its own — including that several rows may share a date.
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  PLAN_ROW_STATUS, PLAN_ROW_STATUSES, canRetry, draftOf,
  planPayload, planCounts, planSummaryLine, isDue, whenLine
} from './scheduledPlanModel.js'

const row = (over = {}) => ({
  _id: 'r1', rowNumber: 2, scheduledDay: '2026-10-01', topic: 'Blog A',
  categoryName: 'Loan Basics', generateImage: true, status: 'scheduled',
  errors: [], blog: null, generatedAt: null, attempts: 0, lastError: null, ...over
})

describe('the states a scheduled row can be in', () => {
  test('each state has a label an admin can read', () => {
    assert.deepEqual(PLAN_ROW_STATUSES,
      ['invalid', 'scheduled', 'generating', 'generated', 'failed', 'missed'])
    for (const key of PLAN_ROW_STATUSES) {
      assert.ok(PLAN_ROW_STATUS[key].label, key)
    }
  })

  test('a generated row says it became a draft, which is the whole point', () => {
    assert.equal(PLAN_ROW_STATUS.generated.label, 'Generated → Draft')
    assert.equal(PLAN_ROW_STATUS.scheduled.label, 'Scheduled')
  })

  test('only a row that did not produce a draft can be retried', () => {
    assert.equal(canRetry(row({ status: 'failed' })), true)
    assert.equal(canRetry(row({ status: 'missed' })), true)
    assert.equal(canRetry(row({ status: 'scheduled' })), false, 'it is simply waiting')
    assert.equal(canRetry(row({ status: 'generating' })), false, 'it is already running')
    assert.equal(canRetry(row({ status: 'generated' })), false, 'a second blog is the one thing to avoid')
    assert.equal(canRetry(row({ status: 'invalid' })), false, 'fix the row first')
    assert.equal(canRetry(null), false)
  })

  test('only a generated row offers its draft', () => {
    const blog = { _id: 'b1', title: 'Blog A', status: 'draft' }
    assert.deepEqual(draftOf(row({ status: 'generated', blog })), blog)
    assert.equal(draftOf(row({ status: 'failed', blog: null })), null)
    assert.equal(draftOf(row({ status: 'scheduled' })), null)
    assert.equal(draftOf(null), null)
  })
})

describe('what the browser sends when a plan is saved', () => {
  test('a validated row travels as what the admin gave', () => {
    const validated = {
      input: { date: '01/10/2026', topic: 'Blog A', category: 'Loan Basics', generateImage: 'Yes' },
      sourceRow: 2
    }
    assert.deepEqual(planPayload([validated]), [{
      date: '01/10/2026', topic: 'Blog A', category: 'Loan Basics', generateImage: 'Yes', sourceRow: 2
    }])
  })

  test('rows sharing a date are all sent, unchanged', () => {
    const rows = ['Blog A', 'Blog B', 'Blog C'].map((topic, i) => ({
      input: { date: '01/10/2026', topic, category: '', generateImage: 'Yes' },
      sourceRow: i + 2
    }))
    const payload = planPayload(rows)
    assert.equal(payload.length, 3)
    assert.deepEqual([...new Set(payload.map((r) => r.date))], ['01/10/2026'],
      'one date, three rows — none is dropped or merged')
    assert.deepEqual(payload.map((r) => r.topic), ['Blog A', 'Blog B', 'Blog C'])
  })

  test('a row without an input block still travels', () => {
    assert.deepEqual(planPayload([{ date: '2026-10-02', topic: 'Blog D', generateImage: false }]), [{
      date: '2026-10-02', topic: 'Blog D', category: '', generateImage: 'No', sourceRow: null
    }])
  })

  test('an empty plan sends nothing rather than a row of blanks', () => {
    assert.deepEqual(planPayload([]), [])
    assert.deepEqual(planPayload(), [])
  })
})

describe('the counts above the table', () => {
  test('a fresh plan is all scheduled', () => {
    assert.deepEqual(planCounts({ total: 62, scheduled: 62 }),
      { total: 62, invalid: 0, scheduled: 62, generated: 0, failed: 0 })
  })

  test('a finished plan is all generated', () => {
    assert.deepEqual(planCounts({ total: 62, generated: 62 }),
      { total: 62, invalid: 0, scheduled: 0, generated: 62, failed: 0 })
  })

  test('a row being generated still counts as outstanding', () => {
    const counts = planCounts({ total: 3, scheduled: 1, generating: 1, generated: 1 })
    assert.equal(counts.scheduled, 2, 'running and waiting are both "not done yet"')
    assert.equal(counts.generated, 1)
  })

  test('missed rows need attention, alongside failures', () => {
    const counts = planCounts({ total: 62, generated: 58, failed: 2, missed: 2 })
    assert.equal(counts.failed, 4)
    assert.equal(counts.generated, 58)
  })

  test('nothing at all is all zeroes, not undefined', () => {
    assert.deepEqual(planCounts(), { total: 0, invalid: 0, scheduled: 0, generated: 0, failed: 0 })
  })
})

describe('what the plan says about itself', () => {
  test('no plan says so plainly', () => {
    assert.equal(planSummaryLine({}), 'No plan saved')
    assert.equal(planSummaryLine(), 'No plan saved')
  })

  test('a fresh plan names its size and what is waiting', () => {
    assert.equal(planSummaryLine({ total: 62, scheduled: 62 }), '62 rows · 62 scheduled')
  })

  test('a part-done plan names each part', () => {
    assert.equal(
      planSummaryLine({ total: 62, scheduled: 0, generated: 60, failed: 2 }),
      '62 rows · 60 generated · 2 needing attention'
    )
  })

  test('one row is a row, not rows', () => {
    assert.equal(planSummaryLine({ total: 1, scheduled: 1 }), '1 row · 1 scheduled')
  })
})

describe('when a row will run', () => {
  const today = '2026-10-01'

  test('days are compared as days, never parsed into a local time', () => {
    assert.equal(isDue(row({ scheduledDay: '2026-10-01' }), today), true)
    assert.equal(isDue(row({ scheduledDay: '2026-09-30' }), today), true)
    assert.equal(isDue(row({ scheduledDay: '2026-10-02' }), today), false)
  })

  test('a row waiting for its day says so', () => {
    assert.equal(whenLine(row({ scheduledDay: '2026-10-05' }), today), 'Waiting for its day')
    assert.equal(whenLine(row({ scheduledDay: today }), today), 'Due today')
  })

  test('a finished row says what happened, not when it will happen', () => {
    assert.equal(whenLine(row({ status: 'generated' }), today), 'Generated')
    assert.equal(whenLine(row({ status: 'missed' }), today), 'Its day passed')
    assert.equal(whenLine(row({ status: 'invalid' }), today), 'Not scheduled')
  })

  test('a row still waiting after its day is overdue, not silently fine', () => {
    assert.equal(whenLine(row({ scheduledDay: '2026-09-28', status: 'scheduled' }), today), 'Overdue')
  })

  test('several rows on one day each answer for themselves', () => {
    const rows = ['Blog A', 'Blog B', 'Blog C'].map((topic) => row({ topic, scheduledDay: today }))
    for (const r of rows) {
      assert.equal(isDue(r, today), true)
      assert.equal(whenLine(r, today), 'Due today')
    }
  })
})
