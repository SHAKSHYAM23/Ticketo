import rateLimit from 'express-rate-limit'
import type { Request } from 'express'


function getClientIp(req: Request): string {
  return (req.ip ?? req.socket.remoteAddress ?? 'unknown')
}

export const loginRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in a minute.' },
  keyGenerator: (req) => getClientIp(req),
  validate: { ip: false }
})

export const resendEmailRateLimit = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 1,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Please wait 2 minutes before requesting another email.' },
  keyGenerator: (req) => {
    const userId = (req as any).user?.userId
    return userId ? `user:${userId}` : getClientIp(req)
  },
  validate: { ip: false }
})

export const generalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 100,  // for te4sting
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
  keyGenerator: (req) => getClientIp(req),
  validate: { ip: false }
})