/**
 * POST /api/contact
 *
 * point.dog contact form handler. SendGrid only — no HubSpot. Leads come in
 * by email and that's enough; we'll add CRM routing if volume ever justifies.
 */

import type { APIRoute } from 'astro'

export const prerender = false

const NOTIFICATION_TO = 'mike@point.dog'
// FROM is on @point.dog directly — point.dog domain is authenticated in SendGrid.
const NOTIFICATION_FROM = { email: 'noreply@point.dog', name: 'point.dog Website' }

type Lead = {
  name: string
  email: string
  company?: string
  interest?: string
  message: string
}

function validate(form: FormData): { ok: true; lead: Lead } | { ok: false; error: string } {
  const honeypot = form.get('website')
  if (typeof honeypot === 'string' && honeypot.length > 0) {
    return { ok: false, error: 'spam' }
  }

  const name = (form.get('name') ?? '').toString().trim()
  const email = (form.get('email') ?? '').toString().trim()
  const message = (form.get('message') ?? '').toString().trim()
  const company = (form.get('company') ?? '').toString().trim() || undefined
  const interest = (form.get('interest') ?? '').toString().trim() || undefined

  if (!name || name.length > 200) return { ok: false, error: 'Name is required.' }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'A valid email is required.' }
  }
  if (!message || message.length > 5000) {
    return { ok: false, error: 'Project details are required.' }
  }

  return { ok: true, lead: { name, email, company, interest, message } }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function sendNotification(lead: Lead, apiKey: string): Promise<void> {
  const html = `
    <h2 style="font-family: Arial, sans-serif;">New lead — point.dog</h2>
    <table style="font-family: Arial, sans-serif; border-collapse: collapse;">
      <tr><td style="padding: 6px 12px 6px 0;"><strong>Name</strong></td><td>${escapeHtml(lead.name)}</td></tr>
      <tr><td style="padding: 6px 12px 6px 0;"><strong>Email</strong></td><td><a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a></td></tr>
      ${lead.company ? `<tr><td style="padding: 6px 12px 6px 0;"><strong>Company</strong></td><td>${escapeHtml(lead.company)}</td></tr>` : ''}
      ${lead.interest ? `<tr><td style="padding: 6px 12px 6px 0;"><strong>Interest</strong></td><td>${escapeHtml(lead.interest)}</td></tr>` : ''}
    </table>
    <h3 style="font-family: Arial, sans-serif; margin-top: 20px;">Project Details</h3>
    <p style="font-family: Arial, sans-serif; white-space: pre-wrap;">${escapeHtml(lead.message)}</p>
  `

  const body = {
    personalizations: [{ to: [{ email: NOTIFICATION_TO }] }],
    from: NOTIFICATION_FROM,
    reply_to: { email: lead.email, name: lead.name },
    subject: `New point.dog lead — ${lead.name}${lead.interest ? ` (${lead.interest})` : ''}`,
    content: [{ type: 'text/html', value: html }],
  }

  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`SendGrid ${res.status}: ${txt}`)
  }
}

export const POST: APIRoute = async ({ request }) => {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return new Response('Invalid request', { status: 400 })
  }

  const result = validate(form)
  if (!result.ok) {
    if (result.error === 'spam') {
      return Response.redirect(new URL('/thank-you', request.url), 303)
    }
    return new Response(result.error, { status: 400 })
  }

  const sendgridKey = import.meta.env.SENDGRID_API_KEY
  if (!sendgridKey) {
    console.warn('[contact] SENDGRID_API_KEY not set — notification email skipped')
    return Response.redirect(new URL('/thank-you', request.url), 303)
  }

  try {
    await sendNotification(result.lead, sendgridKey)
  } catch (err) {
    console.error('[contact] SendGrid delivery failed:', err)
    return new Response(
      'We could not send your message right now. Please email mike@point.dog directly.',
      { status: 500 }
    )
  }

  return Response.redirect(new URL('/thank-you', request.url), 303)
}
