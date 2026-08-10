import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import LoginForm from "./LoginForm";
import styles from "./login.module.css";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="login-title">
        <div className={styles.brand}><i aria-hidden /> MOODua</div>
        <p className={styles.eyebrow}>Наскрізна аналітика</p>
        <h1 id="login-title" className={styles.title}>Вхід у кабінет</h1>
        <p className={styles.copy}>Використайте робочий логін і пароль.</p>
        <LoginForm />
      </section>
    </main>
  );
}
