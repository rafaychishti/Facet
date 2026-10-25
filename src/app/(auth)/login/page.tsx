import Link from "next/link";
import { LoginForm } from "../auth-forms";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-3xl font-medium tracking-tight">Welcome <span className="accent text-blue-glow">back!</span></h1>
      <p className="mt-2 text-sm text-muted">Please enter your details.</p>
      <LoginForm />
      <p className="mt-6 text-center text-sm text-muted">Don&apos;t have an account? <Link href="/signup" className="text-blue-glow hover:underline">Sign up</Link></p>
    </>
  );
}
