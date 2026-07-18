import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export function SampleDataNotice() {
  return (
    <Alert className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">Showing sample data</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We're having trouble loading live information, so this page is showing sample data for now.
        </p>
      </div>
      <Badge variant="warning" className="w-fit shrink-0">
        Sample data
      </Badge>
    </Alert>
  );
}
