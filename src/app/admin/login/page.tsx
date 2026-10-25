import { Suspense } from "react";
import type { Metadata } from "next";
import { Wordmark } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in · Riva Chavan Studio" };

async function Form({ searchParams }: { searchParams: PageProps<"/admin/login">["searchParams"] }) {
  const { next } = await searchParams;
  return <LoginForm next={typeof next === "string" ? next : undefined} />;
}

export default function LoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[26rem] flex-col justify-center px-6 py-16">
      <Wordmark />
      <h1 className="mt-4 font-serif text-[2.25rem] leading-tight tracking-[-0.015em]">Submissions</h1>
      <span aria-hidden="true" className="rule-draw mt-6 block h-px w-full bg-clay" />
      <Suspense fallback={<div className="mt-10 h-40" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
