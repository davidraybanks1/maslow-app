import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_PHONE       = Deno.env.get('TWILIO_PHONE_NUMBER')!
const APP_URL            = 'https://app.mymaslow.com/today'

function getMessage(type: string, name: string): string {
  if (type === 'morning') {
    return `Good morning, ${name} 🌱\n\nHere's your ground for today:\n${APP_URL}\n\nReply STOP to opt out.`
  }
  if (type === 'midday') {
    return `Hey ${name} — halfway through the day.\n\nMark off any practices you've completed:\n${APP_URL}\n\nReply STOP to opt out.`
  }
  if (type === 'evening') {
    return `Good evening, ${name} 🌙\n\nHow did today go? Mark off your completed practices:\n${APP_URL}\n\nReply STOP to opt out.`
  }
  return ''
}

async function sendSMS(to: string, body: string) {
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
  console.log('Sending to:', to)
  console.log('SID prefix:', TWILIO_ACCOUNT_SID?.slice(0, 6))
  console.log('Token length:', TWILIO_AUTH_TOKEN?.length)
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: TWILIO_PHONE, Body: body }),
    }
  )
  const json = await res.json()
  console.log('Twilio response:', JSON.stringify(json))
  return json
}

Deno.serve(async (req) => {
  try {
    const secret = Deno.env.get('CRON_SECRET')
    const authHeader = req.headers.get('Authorization')
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { type } = await req.json()

    if (!['morning', 'midday', 'evening'].includes(type)) {
      return new Response(JSON.stringify({ error: 'Invalid type. Use morning, midday, or evening.' }), { status: 400 })
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, phone, timezone')
      .not('phone', 'is', null)

    if (error) throw error

    const now = new Date()
    const results = []

    for (const user of users) {
      const userTime = new Date(now.toLocaleString('en-US', { timeZone: user.timezone || 'America/Los_Angeles' }))
      const hour = userTime.getHours()
      const targetHour = type === 'morning' ? 8 : type === 'midday' ? 12 : 20

      if (hour !== targetHour) continue

      const message = getMessage(type, user.name)
      if (!message) continue

      const result = await sendSMS(user.phone, message)
      results.push({ user: user.id, sid: result.sid, status: result.status, error: result.message })
    }

    return new Response(JSON.stringify({ sent: results.length, results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Function error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})