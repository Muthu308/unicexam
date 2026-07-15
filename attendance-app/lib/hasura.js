// lib/hasura.js
// Small helper to POST GraphQL requests to Hasura using the admin secret.
// This file only ever runs on the server (inside /api functions), so the
// admin secret is never exposed to the browser.

export async function hasuraRequest(query, variables = {}) {
  const endpoint = process.env.HASURA_URL; // e.g. https://xxxx.hasura.app/v1/graphql
  const adminSecret = process.env.HASURA_SECRET;

  if (!endpoint || !adminSecret) {
    throw new Error(
      "Missing HASURA_ENDPOINT or HASURA_ADMIN_SECRET environment variables"
    );
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-hasura-admin-secret": adminSecret,
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await response.json();

  if (json.errors) {
    const message = json.errors.map((e) => e.message).join("; ");
    throw new Error(message);
  }

  return json.data;
}
