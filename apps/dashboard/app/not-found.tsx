import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <AppShell>
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <p className="text-muted-foreground">Page not found.</p>
          <Button variant="outline" asChild>
            <Link href="/servers">Back to servers</Link>
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
