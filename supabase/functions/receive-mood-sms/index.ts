import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')!
const VALID_MOODS = ['good', 'fine', 'bad']

function twiml(message: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

async function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): Promise<boolean> {
  // Twilio signs: URL + alphabetically sorted key+value pairs concatenated
  const sortedKeys = Object.keys(params).sort()
  const str = url + sortedKeys.map(k => k + params[k]).join('')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  const sigBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(str))
  const computed = btoa(String.fromCharCode(...new Uint8Array(sigBytes)))
  return computed === signature
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const rawBody = await req.text()
  const params: Record<string, string> = {}
  for (const [k, v] of new URLSearchParams(rawBody)) {
    params[k] = v
  }

  // Validate that the request is genuinely from Twilio
  const signature = req.headers.get('X-Twilio-Signature') ?? ''
  const isValid = await validateTwilioSignature(TWILIO_AUTH_TOKEN, signature, req.url, params)
  if (!isValid) {
    return new Response('Forbidden', { status: 403 })
  }

  const rawText = (params.Body ?? '').trim()
  const body = rawText.toLowerCase()
  const from = params.From ?? ''

  if (!from) {
    return twiml('Could not process your message.')
  }

  // Look up user by phone number
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('phone', from)
    .maybeSingle()

  if (!user) {
    return twiml("We couldn't find your account. Make sure your phone number is registered.")
  }

  if (VALID_MOODS.includes(body)) {
    await supabase.from('moods').insert({
      user_id: user.id,
      mood: body,
      date_key: todayKey(),
      prompt_time: 'sms',
    })
    return twiml('Logged. Reply with a note to add context, or ignore this message.')
  }

  // Not a mood keyword — check if the last mood (within 10 min, no note) can receive this as a note
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data: recentMood } = await supabase
    .from('moods')
    .select('id')
    .eq('user_id', user.id)
    .is('note', null)
    .gte('created_at', tenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (recentMood) {
    await supabase
      .from('moods')
      .update({ note: rawText })
      .eq('id', recentMood.id)
    return twiml('Note added.')
  }

  return twiml('Reply "good", "fine", or "bad" to log your mood.')
})
