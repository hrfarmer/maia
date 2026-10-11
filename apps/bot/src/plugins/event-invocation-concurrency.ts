export class PluginEventInvocationConcurrency {
  private readonly active = new Map<string, number>();

  tryAcquire(pluginId: string, limit: number): boolean {
    const current = this.active.get(pluginId) ?? 0;
    if (current >= limit) {
      return false;
    }
    this.active.set(pluginId, current + 1);
    return true;
  }

  release(pluginId: string) {
    const current = this.active.get(pluginId) ?? 0;
    if (current <= 1) {
      this.active.delete(pluginId);
      return;
    }
    this.active.set(pluginId, current - 1);
  }

  activeCount(pluginId: string): number {
    return this.active.get(pluginId) ?? 0;
  }
}
