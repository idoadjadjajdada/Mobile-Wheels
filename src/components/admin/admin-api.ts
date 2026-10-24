"use client";

export class AdminError extends Error {
  constructor(
    message: string,
    public status: number,
    public issues?: { message: string; path?: (string | number)[] }[],
  ) {
    super(message);
  }
}

export async function adminFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issues = body.issues as AdminError["issues"];
    const detail = issues?.length ? `: ${issues.map((i) => `${i.path?.join(".") ?? ""} ${i.message}`.trim()).join("; ")}` : "";
    throw new AdminError(`${body.error ?? `Request failed (${res.status})`}${detail}`, res.status, issues);
  }
  return body as T;
}
