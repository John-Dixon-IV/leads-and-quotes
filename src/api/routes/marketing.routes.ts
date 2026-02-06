import express, { Request, Response } from 'express';
import path from 'path';
import db from '../../db/client';
import * as dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

/**
 * GET / - Serve the marketing landing page
 */
router.get('/', (req: Request, res: Response) => {
  const indexPath = path.join(process.cwd(), 'public', 'index.html');
  res.sendFile(indexPath);
});

/**
 * POST /lead-capture - Capture leads from the marketing page
 * These are potential customers (contractors) interested in our SaaS
 */
router.post('/lead-capture', async (req: Request, res: Response) => {
  try {
    const { name, company, email, phone, services, website } = req.body;

    // Validate required fields
    if (!name || !company || !email || !phone) {
      return res.status(400).json({
        error: 'Missing required fields',
        code: 'MISSING_FIELDS',
      });
    }

    // Create a special "marketing lead" session
    const sessionId = `marketing-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create a session for tracking
    await db.query(
      `INSERT INTO sessions (session_id, customer_id, message_count, created_at)
       VALUES ($1, $2, 1, NOW())`,
      [sessionId, 'marketing-leads'] // Special customer_id for our own leads
    );

    // Create a lead entry for this hot prospect
    const leadData = {
      visitor_name: name,
      visitor_email: email,
      visitor_phone: phone,
      company_name: company,
      services_offered: services || null,
      website: website || null,
      classification: {
        service_type: 'saas_subscription',
        urgency: 'high',
        urgency_score: 0.9,
        confidence: 1.0,
        is_qualified: true,
      },
    };

    await db.query(
      `INSERT INTO leads (
        customer_id,
        session_id,
        visitor_name,
        visitor_email,
        visitor_phone,
        classification,
        is_qualified,
        is_complete,
        message_count,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, 1, NOW(), NOW()
      )`,
      [
        'marketing-leads',
        sessionId,
        name,
        email,
        phone,
        JSON.stringify(leadData.classification),
        true,
        true,
      ]
    );

    // Log to notifications table for tracking
    await db.query(
      `INSERT INTO notifications (
        customer_id,
        notification_type,
        recipient,
        subject,
        message,
        sent_at
      )
      VALUES (
        $1, $2, $3, $4, $5, NOW()
      )`,
      [
        'marketing-leads',
        'marketing_lead_captured',
        email,
        `New SaaS Lead: ${company}`,
        `Name: ${name}\nCompany: ${company}\nEmail: ${email}\nPhone: ${phone}\nServices: ${services || 'Not provided'}\nWebsite: ${website || 'Not provided'}`,
      ]
    );

    console.log(`[Marketing] New lead captured: ${company} (${email})`);

    res.status(200).json({
      success: true,
      message: 'Thank you! We\'ll be in touch soon.',
    });
  } catch (error: any) {
    console.error('[Marketing] Lead capture failed:', error);
    res.status(500).json({
      error: 'Failed to capture lead',
      code: 'LEAD_CAPTURE_FAILED',
    });
  }
});

/**
 * GET /admin - Redirect to admin dashboard (placeholder)
 */
router.get('/admin', (req: Request, res: Response) => {
  // For now, redirect to admin stats endpoint
  // In the future, this could serve an admin dashboard UI
  res.redirect('/api/v1/admin/stats');
});

export default router;
