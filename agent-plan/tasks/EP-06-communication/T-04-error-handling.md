# T-04 — Error Handling

**Epic**: EP-06 (Extension ↔ CoApp Communication)
**Priority**: P1
**Status**: NS (not started)
**Last updated**: 2026-04-06 22:30

---

## Goal

Implement comprehensive error handling for communication failures.

---

## Subtasks

- [ ] Define error types
- [ ] Implement connection error handling
- [ ] Implement timeout handling
- [ ] Implement CoApp crash handling
- [ ] Implement retry logic
- [ ] Log errors for debugging

---

## Error Types

```typescript
// extension/src/lib/errors.ts

export class CoAppError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = true
  ) {
    super(message);
    this.name = 'CoAppError';
  }
}

export class ConnectionError extends CoAppError {
  constructor(message: string) {
    super(message, 'CONNECTION_ERROR', true);
  }
}

export class TimeoutError extends CoAppError {
  constructor(method: string) {
    super(`Method '${method}' timed out`, 'TIMEOUT', true);
  }
}

export class MethodError extends CoAppError {
  constructor(message: string) {
    super(message, 'METHOD_ERROR', false);
  }
}

export class FFmpegError extends CoAppError {
  constructor(message: string, public exitCode?: number) {
    super(message, 'FFMPEG_ERROR', false);
  }
}
```

---

## Error Recovery

```typescript
// extension/src/lib/native-client.ts

async withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      
      if (!e.recoverable) {
        throw e;
      }
      
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, e.message);
      
      if (attempt < maxRetries) {
        await this.sleep(delay * attempt);
      }
    }
  }
  
  throw lastError!;
}

private sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## Tests

- [ ] Connection errors trigger reconnect
- [ ] Method errors are thrown correctly
- [ ] Retry logic works
- [ ] Errors are logged
