// Use configured application origin, never a client-provided redirect target.
export function appOrigin() {
  const value =
    process.env.APP_URL ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  if (!value) throw new Error("APP_URL is required in production.");
  const url = new URL(value);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !(url.protocol === "https:" || (url.protocol === "http:" && local))
  )
    throw new Error(
      "APP_URL must be an HTTPS origin or local development origin.",
    );
  return url.origin;
}
