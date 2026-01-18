
import { GameEngine } from '../GameEngine';

export interface Command {
    type: string;
    execute(engine: GameEngine): void;
}
