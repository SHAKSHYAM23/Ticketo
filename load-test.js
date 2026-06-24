import http from 'k6/http'
import { sleep, check, group } from 'k6'
import { Counter, Trend, Rate } from 'k6/metrics'
import exec from 'k6/execution'

const BASE_URL = 'http://localhost:8000'
const TEST_EMAIL = 'rahul@test.com'
const TEST_PASSWORD = 'Test@123'

const seatLockErrors = new Counter('seat_lock_errors')
const seatLockDuration = new Trend('seat_lock_duration_ms')
const lockSuccessRate = new Rate('lock_success_rate')

export const options = {
  stages: [
    { duration: '30s', target: 200 },
    { duration: '60s', target: 500 },
    { duration: '90s', target: 1000 },
    { duration: '90s', target: 1000 },
    { duration: '30s', target: 0 },
  ],

  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.1'],
    seat_lock_duration_ms: ['p(95)<1000'],
    lock_success_rate: ['rate>0.05'],
  },

  summaryTrendStats: [
    'avg',
    'min',
    'med',
    'max',
    'p(90)',
    'p(95)',
    'p(99)',
  ],
}

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )

  const loginOk = check(loginRes, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => r.json('token') !== null,
  })

  if (!loginOk) {
    console.error('Login failed.')
    return {}
  }

  const token = loginRes.json('token')

  const eventsRes = http.get(`${BASE_URL}/api/events`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  const events = eventsRes.json()

  if (!events || events.length === 0) {
    console.error('No events found.')
    return {}
  }

  const event = events.reduce((max, e) =>
    (e.totalSeats ?? 0) > (max.totalSeats ?? 0) ? e : max
  )

  const eventId = event.id

  const seatsRes = http.get(
    `${BASE_URL}/api/events/${eventId}/seats`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  )

  const seatsData = seatsRes.json()

  const availableSeatIds = Object.values(seatsData.rows ?? {})
    .flat()
    .filter((seat) => seat.status === 'available')
    .map((seat) => seat.id)

  console.log('─────────────────────────────────')
  console.log(`Event: ${event.title}`)
  console.log(`Event ID: ${eventId}`)
  console.log(`Available Seats: ${availableSeatIds.length}`)
  console.log('─────────────────────────────────')

  if (availableSeatIds.length === 0) {
    console.error('No available seats.')
    return {}
  }

  return {
    token,
    eventId,
    availableSeatIds,
  }
}

export default function (data) {
  if (!data.token || !data.eventId || !data.availableSeatIds) {
    return
  }

  const virtualUserId = `test-user-${exec.vu.idInTest}`

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
    'x-test-user-id': virtualUserId,
  }

  group('browse events', () => {
    const res = http.get(`${BASE_URL}/api/events`, { headers })

    check(res, {
      'events 200': (r) => r.status === 200,
      'events array': (r) => Array.isArray(r.json()),
    })
  })

  sleep(1)

  group('view seat map', () => {
    const res = http.get(
      `${BASE_URL}/api/events/${data.eventId}/seats`,
      { headers }
    )

    check(res, {
      'seat map 200': (r) => r.status === 200,
      'seat map latency': (r) => r.timings.duration < 2000,
    })
  })

  sleep(1)

  group('seat lock stampede', () => {
    const randomIndex = Math.floor(
      Math.random() * data.availableSeatIds.length
    )

    const seatId = data.availableSeatIds[randomIndex]

    const res = http.post(
      `${BASE_URL}/api/seats/lock-many`,
      JSON.stringify({
        seatIds: [seatId],
        eventId: data.eventId,
      }),
      { headers }
    )

    seatLockDuration.add(res.timings.duration)

    const valid = check(res, {
      'lock response valid': (r) =>
        r.status === 200 ||
        r.status === 409 ||
        r.status === 400,
    })

    lockSuccessRate.add(res.status === 200)

    if (!valid) {
      seatLockErrors.add(1)
    }
  })

  sleep(2)

  group('view bookings', () => {
    const res = http.get(`${BASE_URL}/api/bookings/me`, {
      headers,
    })

    check(res, {
      'bookings 200': (r) => r.status === 200,
    })
  })

  sleep(1)
}

export function teardown(data) {
  console.log('─────────────────────────────────')
  console.log('Load test completed')
  console.log(`Event: ${data.eventId}`)
  console.log(`Available Seats: ${data.availableSeatIds?.length}`)
  console.log('Duration: ~5 minutes')
  console.log('Grafana: http://localhost:3001')
  console.log('─────────────────────────────────')
}