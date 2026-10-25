import Link from "next/link";
import { logout } from "@/app/admin/actions";
import { Download } from "@/components/Icons";
import { buttonClass, Wordmark } from "@/components/ui";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-16 w-full max-w-[64rem] items-center justify-between gap-4 px-6 sm:px-8">
          <Link href="/admin" className="flex items-baseline gap-4 rounded-[2px]">
            <Wordmark />
            <span className="hidden text-sm text-ink-2 sm:inline">Submissions</span>
          </Link>
          <nav className="flex items-center gap-4" aria-label="Admin">
            <a href="/api/admin/export" className={buttonClass("outline", "min-h-10 px-4 text-sm")} download>
              <Download size={16} /> Export all
            </a>
            <form action={logout}>
              <button type="submit" className={buttonClass("quiet", "min-h-10 text-sm")}>
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
