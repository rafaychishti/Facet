import Link from "next/link";
import { ForgotForm } from "../auth-forms";

export const metadata = { title: "Reset password" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="text-3xl font-medium tracking-tight">Reset your <span className="accent text-blue-glow">password</span></h1>
      <p className="mt-2 text-sm text-muted">We&apos;ll email you a link to choose a new one.</p>
      <ForgotForm />
      <p className="mt-6 text-center text-sm text-muted"><Link href="/login" className="text-blue-glow hover:underline">Back to log in</Link></p>
    </>
  );
}
