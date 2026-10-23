import express, { NextFunction, Request, Response } from 'express';

/**
 * Capture raw request bytes on every request so the webhook handler can
 * HMAC-verify exactly what the provider sent. Re-serialising JSON would
 * change the byte stream and break signature verification.
 */
const parser = express.json({
  limit: '256kb',
  verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
    req.rawBody = buf;
  },
});

export function rawBodyMiddleware(req: Request, res: Response, next: NextFunction) {
  parser(req, res, next);
}