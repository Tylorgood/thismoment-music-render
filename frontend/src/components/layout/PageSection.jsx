import { cn } from "@/lib/utils";
import DetailPanel from "@/components/layout/DetailPanel";

export default function PageSection({
  title,
  description,
  actions,
  children,
  as = "section",
  className,
  bodyClassName,
}) {
  const Tag = as;
  return (
    <Tag className={cn("min-w-0", className)}>
      <DetailPanel
        title={title}
        description={description}
        actions={actions}
        bodyClassName={bodyClassName}
      >
        {children}
      </DetailPanel>
    </Tag>
  );
}