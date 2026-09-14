import { Link } from "react-router-dom";
import { Ghost } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/layout";

export default function Placeholder({ title, description, ctaLabel, ctaTo }) {
  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <PageHeader title={title} subtitle="This space opens in a later phase of the Music Arcade build." />
      <div className="flex items-center justify-center px-6 py-10">
        <EmptyState
          icon={Ghost}
          title={title}
          description={description}
          actions={
            ctaLabel &&
            ctaTo && (
              <Link
                to={ctaTo}
                className="ma-ring-focus inline-flex items-center rounded-sm ma-accent-bg px-4 py-2 text-sm font-medium hover:opacity-90"
              >
                {ctaLabel}
              </Link>
            )
          }
        />
      </div>
    </div>
  );
}