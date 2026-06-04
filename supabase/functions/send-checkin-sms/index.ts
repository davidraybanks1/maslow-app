import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')!
const TWILIO_AUTH_TOKEN  = Deno.env.get('TWILIO_AUTH_TOKEN')!
const TWILIO_PHONE       = Deno.env.get('TWILIO_PHONE_NUMBER')!

const MESSAGES: Record<string, string> = {
  morning: "Your needs don't take a day off. Neither should you. Check in with yourself → https://app.mymaslow.com",
  midday:  "Halfway through. Anxiety fills the space your unmet needs leave behind. How's the space looking? → https://app.mymaslow.com",
  evening: "The day is almost done. Meeting your needs isn't about perfection — it's about showing up. How did you show up today? → https://app.mymaslow.com",
}

async function sendSMS(to: string, body: string) {
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)
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
    const internalSecret = Deno.env.get('INTERNAL_SECRET')
    const keyHeader = req.headers.get('X-Internal-Key')
    if (!internalSecret || keyHeader !== internalSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { prompt_time } = await req.json()

    if (!MESSAGES[prompt_time]) {
      return new Response(
        JSON.stringify({ error: 'Invalid prompt_time. Use: morning, midday, or evening.' }),
        { status: 400 }
      )
    }

    const message = MESSAGES[prompt_time]

    const { data: users, error } = await supabase
      .from('users')
      .select('id, phone')
      .not('phone', 'is', null)

    if (error) throw error

    const results = []
    for (const user of users) {
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
