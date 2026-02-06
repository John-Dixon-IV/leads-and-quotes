import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();

/**
 * Serve widget.js with correct MIME type and CORS headers
 */
router.get('/widget.js', (req: Request, res: Response) => {
  const widgetPath = path.join(__dirname, '../../../public/widget.js');

  // Check if file exists
  if (!fs.existsSync(widgetPath)) {
    res.status(404).json({
      error: 'Widget script not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  // Set CORS headers to allow embedding from any domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Set content type
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');

  // Set cache headers (cache for 1 hour in production, no cache in dev)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  } else {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  // Send file
  res.sendFile(widgetPath);
});

/**
 * Serve demo/test page
 */
router.get('/demo', (req: Request, res: Response) => {
  const demoPath = path.join(__dirname, '../../../public/demo.html');

  if (!fs.existsSync(demoPath)) {
    res.status(404).send('Demo page not found');
    return;
  }

  res.sendFile(demoPath);
});

export default router;
