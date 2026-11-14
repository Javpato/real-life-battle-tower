/** One request per physical entry. A rejection never leaves movement locked. */
export class PortalInteraction {
  pending = false;
  latchedId: string | null = null;

  leaveThreshold(insideLatchedPortal: boolean) {
    if (!insideLatchedPortal && !this.pending) this.latchedId = null;
  }

  async request(id: string, send: () => Promise<boolean>): Promise<boolean> {
    if (this.pending || this.latchedId === id) return false;
    this.latchedId = id;
    this.pending = true;
    try {
      return (await send()) === true;
    } catch {
      return false;
    } finally {
      this.pending = false;
    }
  }
}
