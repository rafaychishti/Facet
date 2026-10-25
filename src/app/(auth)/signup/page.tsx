import Link from "next/link";
import { SignupForm } from "../auth-forms";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-3xl font-medium tracking-tight">Create your <span className="accent text-blue-glow">account</span></h1>
      <p className="mt-2 text-sm text-muted">Free forever. Start a 14-day Pro trial any time.</p>
      <SignupForm />
      <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link href="/login" className="text-blue-glow hover:underline">Log in</Link></p>
    </>
  );
}
