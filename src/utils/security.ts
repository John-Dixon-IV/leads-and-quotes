/**
 * Security Utilities
 *
 * Production-grade security functions for:
 * - Prompt injection detection
 * - Input sanitization
 * - Multi-tenant validation
 */

/**
 * Prompt injection patterns to detect
 */
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous\s+)?instructions?/i,
  /system\s+prompt/i,
  /you\s+are\s+(now\s+)?a\s+/i,
  /new\s+(system\s+)?instructions?/i,
  /disregard\s+(all\s+)?/i,
  /forget\s+(everything|all|previous)/i,
  /act\s+as\s+(if\s+)?/i,
  /roleplay\s+as/i,
  /pretend\s+(to\s+be|you\s+are)/i,
  /simulate\s+/i,
];

/**
 * Spam/abuse patterns
 */
const SPAM_PATTERNS = [
  /(.)\1{20,}/, // 20+ repeated characters
  /^[A-Z\s!]{50,}$/, // All caps, 50+ characters
  /(https?:\/\/[^\s]+.*){5,}/, // 5+ URLs
];

export interface SecurityCheckResult {
  passed: boolean;
  reason?: string;
  shouldTerminate: boolean;
}

/**
 * Check message for prompt injection attempts
 */
export function checkPromptInjection(message: string): SecurityCheckResult {
  if (!message || message.trim().length === 0) {
    return {
      passed: true,
      shouldTerminate: false,
    };
  }

  const normalizedMessage = message.toLowerCase().trim();

  // Check for prompt injection patterns
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(normalizedMessage)) {
      return {
        passed: false,
        reason: 'Prompt injection detected',
        shouldTerminate: true,
      };
    }
  }

  // Check for spam patterns
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(message)) {
      return {
        passed: false,
        reason: 'Spam pattern detected',
        shouldTerminate: true,
      };
    }
  }

  return {
    passed: true,
    shouldTerminate: false,
  };
}

/**
 * Validate customer_id format (UUID v4)
 */
export function validateCustomerId(customerId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(customerId);
}

/**
 * Validate lead belongs to customer (multi-tenant check)
 */
export function validateLeadOwnership(leadCustomerId: string, requestCustomerId: string): boolean {
  return leadCustomerId === requestCustomerId;
}

/**
 * Sanitize message for safe storage
 */
export function sanitizeMessage(message: string): string {
  if (!message) return '';

  // Remove null bytes
  let sanitized = message.replace(/\0/g, '');

  // Limit length
  if (sanitized.length > 2000) {
    sanitized = sanitized.substring(0, 2000);
  }

  return sanitized.trim();
}

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Simple in-memory rate limiter for message count per session
 */
const messageRateLimits = new Map<string, { count: number; resetAt: number }>();

export function checkMessageRateLimit(
  sessionId: string,
  maxMessages: number,
  windowMs: number = 60000
): RateLimitResult {
  const now = Date.now();
  const limit = messageRateLimits.get(sessionId);

  if (!limit || now > limit.resetAt) {
    // Reset or create new limit
    messageRateLimits.set(sessionId, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      allowed: true,
      remaining: maxMessages - 1,
      resetAt: new Date(now + windowMs),
    };
  }

  if (limit.count >= maxMessages) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(limit.resetAt),
    };
  }

  limit.count++;
  messageRateLimits.set(sessionId, limit);

  return {
    allowed: true,
    remaining: maxMessages - limit.count,
    resetAt: new Date(limit.resetAt),
  };
}

/**
 * Clean up old rate limit entries (call periodically)
 */
export function cleanupRateLimits(): void {
  const now = Date.now();
  for (const [sessionId, limit] of messageRateLimits.entries()) {
    if (now > limit.resetAt) {
      messageRateLimits.delete(sessionId);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);
