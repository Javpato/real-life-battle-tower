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

/** Arrival time is wall-clock based: asset loading never consumes the safe second. */
export class ArrivalProtection {
  private readyAt=0;
  private held=new Set<string>();
  private carried=new Set<string>();
  constructor(readonly delay=1000){}
  arrive(now:number){this.readyAt=now+this.delay;this.carried=new Set(this.held);}
  release(input:string){this.held.delete(input);this.carried.delete(input);}
  press(input:string,now:number){const fresh=!this.held.has(input);this.held.add(input);return fresh&&this.ready(now);}
  ready(now:number){return now>=this.readyAt&&this.carried.size===0;}
  clear(){this.held.clear();this.carried.clear();}
}
