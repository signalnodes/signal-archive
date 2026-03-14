"use client";

import Link from "next/link";

interface DeletionPaginationProps {
  currentPage: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

export function DeletionPagination({ currentPage, totalPages, buildHref }: DeletionPaginationProps) {
  function handleClick() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="flex items-center justify-between mt-6 pt-4 border-t">
      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex gap-2">
        {currentPage > 1 && (
          <Link
            href={buildHref(currentPage - 1)}
            onClick={handleClick}
            className="text-sm px-3 py-1.5 rounded border hover:bg-muted transition-colors"
          >
            ← Previous
          </Link>
        )}
        {currentPage < totalPages && (
          <Link
            href={buildHref(currentPage + 1)}
            onClick={handleClick}
            className="text-sm px-3 py-1.5 rounded border hover:bg-muted transition-colors"
          >
            Next →
          </Link>
        )}
      </div>
    </div>
  );
}
