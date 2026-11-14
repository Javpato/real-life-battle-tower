import type { TowerBattle } from './model';

/** Announce a live win transition, never a restored result or a boss phase. */
export class VictoryAnnouncement {
  private previous: {id:string;turn:TowerBattle['turn']} | null = null;
  observe(battle: Pick<TowerBattle,'id'|'turn'|'enemy'> | null): string | null {
    const previous = this.previous;
    this.previous = battle ? {id:battle.id,turn:battle.turn} : null;
    if (!battle || previous?.id !== battle.id || previous.turn === 'won' || battle.turn !== 'won') return null;
    return `You defeated ${battle.enemy.name}!`;
  }
}
