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

/**
 * Serve CSS files
 */
router.get('/css/:filename', (req: Request, res: Response) => {
  const { filename } = req.params;
  const cssPath = path.join(__dirname, '../../../public/css', filename);

  if (!fs.existsSync(cssPath)) {
    res.status(404).json({
      error: 'CSS file not found',
      code: 'NOT_FOUND',
    });
    return;
  }

  res.setHeader('Content-Type', 'text/css; charset=utf-8');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
  } else {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  }

  res.sendFile(cssPath);
});

/**
 * Serve robots.txt for SEO
 */
router.get('/robots.txt', (req: Request, res: Response) => {
  const robotsPath = path.join(__dirname, '../../../public/robots.txt');

  if (!fs.existsSync(robotsPath)) {
    res.status(404).send('Not found');
    return;
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours

  res.sendFile(robotsPath);
});

/**
 * Serve sitemap.xml for SEO
 */
router.get('/sitemap.xml', (req: Request, res: Response) => {
  const sitemapPath = path.join(__dirname, '../../../public/sitemap.xml');

  if (!fs.existsSync(sitemapPath)) {
    res.status(404).send('Not found');
    return;
  }

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours

  res.sendFile(sitemapPath);
});

export default router;
