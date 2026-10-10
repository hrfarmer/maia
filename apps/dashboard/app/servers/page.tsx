export default function ServersPage() {
  return (
    <div className="flex flex-1 flex-col justify-center py-12">
      <h1 className="text-xl font-semibold tracking-tight">Select a server</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Choose a server from the sidebar to manage members, roles, commands, audit
        log, and API keys.
      </p>
    </div>
  );
}
