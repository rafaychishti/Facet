import { ResetForm } from "../auth-forms";

export const metadata = { title: "Choose a new password" };

export default function ResetPage() {
  return (
    <>
      <h1 className="text-3xl font-medium tracking-tight">Choose a new <span className="accent text-blue-glow">password</span></h1>
      <ResetForm />
    </>
  );
}
