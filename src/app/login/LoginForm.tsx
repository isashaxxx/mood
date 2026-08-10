"use client";

import { FormEvent, useState } from "react";
import styles from "./login.module.css";

function safeDestination(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Не вдалося увійти");
      window.location.assign(safeDestination());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Не вдалося увійти");
      setSending(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label>
        <span>Логін</span>
        <input
          autoComplete="username"
          autoFocus
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
        />
      </label>
      <label>
        <span>Пароль</span>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button type="submit" disabled={sending}>{sending ? "Входимо…" : "Увійти"}</button>
    </form>
  );
}
