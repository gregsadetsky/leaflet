"use server";

import { randomBytes } from "crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { phone_number_auth_tokens } from "drizzle/schema";
import twilio from "twilio";

async function sendAuthCode({
  country_code,
  phone_number,
  code,
}: {
  country_code: string;
  phone_number: string;
  code: string;
}) {
  let phoneNumber = `+${country_code}${phone_number}`;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = twilio(accountSid, authToken);
  if (country_code === "1") {
    const message = await client.messages.create({
      body: `${code} is your verification code

@leaflet.pub #${code}`,
      from: `+18449523391`,
      to: phoneNumber,
    });
    console.log(message);
  } else {
    const message = await client.messages.create({
      contentSid: "HX5ebfae4d2a423808486e773e8a22488d",
      contentVariables: JSON.stringify({ 1: code }),
      from: "whatsapp:+18449523391",
      messagingServiceSid: "MGffbf9a66770350b25caf3b80b9aac481",
      to: `whatsapp:${phoneNumber}`,
    });
  }
}

export async function createPhoneAuthToken({
  phone_number,
  country_code,
}: {
  phone_number: string;
  country_code: string;
}) {
  const client = postgres(process.env.DB_URL as string, { idle_timeout: 5 });
  const db = drizzle(client);

  const code = randomBytes(3).toString("hex").toUpperCase();

  const [token] = await db
    .insert(phone_number_auth_tokens)
    .values({
      phone_number,
      country_code,
      confirmation_code: code,
      confirmed: false,
    })
    .returning({
      id: phone_number_auth_tokens.id,
    });

  await sendAuthCode({ country_code, phone_number, code });

  client.end();
  return token.id;
}
