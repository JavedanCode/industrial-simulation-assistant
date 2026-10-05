export class SimulationClock {
  private currentTime: number = 0;

  getTime(): number {
    return this.currentTime;
  }

  advanceTime(delta: number): number {
    this.currentTime += delta;
    return this.currentTime;
  }
}
