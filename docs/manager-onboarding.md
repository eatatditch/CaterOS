# Catering manager onboarding

You're using CaterOS to track every catering lead from first contact through
delivery. The dashboards only tell the truth if your activity log is honest.
This page covers the five rules that make the system work.

## 1. Every lead has an owner — yours is you

When an inbound lead comes in through the web form, it lands in your
`/app/my-pipeline` with the **Unanswered** badge. The clock starts at the
moment the form was submitted. Your SLA is **4 hours**. After 4h it turns
yellow on my scoreboard. After 24h it turns red.

To clear the badge: open the lead and log a call, email, or meeting from the
quick-action row at the bottom of the deal page. Anything else doesn't count
as a response.

## 2. Log activity in the moment, not at end of day

The deal page has a one-tap activity row: **Call · Email · Meeting · Tasting.**
Tapping any of those creates the activity immediately with you as the owner.
You can add a subject and notes afterward, but the row is logged.

Specifically:
- **Call** — every phone call you make or receive. Even the 30-second "leaving
  a voicemail" calls.
- **Email** — every email you send. Inbound emails the system imports
  automatically from Gmail.
- **Meeting** — Zoom calls, coffee meets, anything where you talked face to
  face.
- **Tasting** — they came in or you came to them with food. Counts heavily
  toward your weekly goal.
- **Site visit** — you went to the venue. Counts toward your weekly goal.
- **Proposal sent** — auto-logged when you send a quote, but log it manually
  if you sent something outside the system (PDF over email, etc.).
- **Follow-up** — explicit check-ins on quote-sent or follow-up stage deals.
- **Networking** — events, conferences, referral coffee chats. Counts when
  setting goals.

## 3. Move the stage when something material happens

The five stages:
1. **Lead** — they reached out, you haven't qualified yet.
2. **Quote Sent** — you've sent a formal price.
3. **Follow up** — they've seen the quote, you're closing the loop.
4. **Booked** — they signed. Confirms the deal as won.
5. **Lost** — they're not going to book. **Always** fill in `lost_reason`.

If you don't move stages, the funnel report lies. If you don't fill in lost
reasons, we can't fix the patterns.

## 4. Track outbound prospects in `/app/prospects`

Cold companies you're working on go in `/app/prospects` — **not** in the
main deals pipeline. Once they reply, click **Convert to lead** and the
system creates the contact, company, and deal automatically with
`source = outbound`.

For every prospect, set a **next touch date** so they show up on your
`/app/my-pipeline` outbound queue when they're due.

## 5. Mark events delivered + enter costs

After an event ships:
- Set its status to **Delivered** on the event page.
- Enter `gross_revenue_cents`, `food_cost_cents`, `labor_cost_cents`. The
  margin column is computed automatically.
- If it's a repeat client, set `parent_event_id` to their previous event.

That's how delivered revenue and repeat-rate metrics come to life.

## What I see vs what you see

You see only **your** deals, your activity, your prospects. I (owner) see
everyone across both locations. That's by design — your dashboard isn't
cluttered with anyone else's work, and my scoreboard tells me where coaching
is needed.

If you ever want temporary visibility into someone else's pipeline (covering
PTO, hand-off, etc.), tell me and I'll bump your role for the week.
