/**
 * Commands - Input action definitions
 *
 * Each user input becomes a Command that the engine processes.
 * Commands are validated and then applied to state.
 *
 * C# Note: Maps directly to C# command pattern interfaces.
 */

// Command type discriminator
export enum CommandType {
  MOVE_BOARD = 'MOVE_BOARD',
  ROTATE_PIECE = 'ROTATE_PIECE',
  HARD_DROP = 'HARD_DROP',
  SOFT_DROP_START = 'SOFT_DROP_START',
  SOFT_DROP_END = 'SOFT_DROP_END',
  SWAP_PIECE = 'SWAP_PIECE',
  TAP_BLOCK = 'TAP_BLOCK',
  PAUSE = 'PAUSE',
  RESUME = 'RESUME',
  RESTART = 'RESTART',
}

// Base command interface
export interface GameCommand {
  type: CommandType;
  timestamp: number;
}

// Movement command
export interface MoveBoardCommand extends GameCommand {
  type: CommandType.MOVE_BOARD;
  direction: 1 | -1; // 1 = left, -1 = right
}

// Rotation command
export interface RotatePieceCommand extends GameCommand {
  type: CommandType.ROTATE_PIECE;
  clockwise: boolean;
}

// Hard drop command
export interface HardDropCommand extends GameCommand {
  type: CommandType.HARD_DROP;
}

// Soft drop commands
export interface SoftDropStartCommand extends GameCommand {
  type: CommandType.SOFT_DROP_START;
}

export interface SoftDropEndCommand extends GameCommand {
  type: CommandType.SOFT_DROP_END;
}

// Swap/hold piece command
export interface SwapPieceCommand extends GameCommand {
  type: CommandType.SWAP_PIECE;
}

// Tap to clear group command
export interface TapBlockCommand extends GameCommand {
  type: CommandType.TAP_BLOCK;
  x: number; // Grid X coordinate
  y: number; // Grid Y coordinate
}

// Pause/Resume commands
export interface PauseCommand extends GameCommand {
  type: CommandType.PAUSE;
}

export interface ResumeCommand extends GameCommand {
  type: CommandType.RESUME;
}

// Restart command
export interface RestartCommand extends GameCommand {
  type: CommandType.RESTART;
}

// Union type for all commands
export type AnyCommand =
  | MoveBoardCommand
  | RotatePieceCommand
  | HardDropCommand
  | SoftDropStartCommand
  | SoftDropEndCommand
  | SwapPieceCommand
  | TapBlockCommand
  | PauseCommand
  | ResumeCommand
  | RestartCommand;

// Command factory functions
export function createCommand<T extends GameCommand>(
  type: T['type'],
  data?: Omit<T, 'type' | 'timestamp'>
): T {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  } as T;
}

// Convenience creators
export const Commands = {
  moveBoard: (direction: 1 | -1): MoveBoardCommand =>
    createCommand<MoveBoardCommand>(CommandType.MOVE_BOARD, { direction }),

  rotate: (clockwise: boolean): RotatePieceCommand =>
    createCommand<RotatePieceCommand>(CommandType.ROTATE_PIECE, { clockwise }),

  hardDrop: (): HardDropCommand =>
    createCommand<HardDropCommand>(CommandType.HARD_DROP),

  softDropStart: (): SoftDropStartCommand =>
    createCommand<SoftDropStartCommand>(CommandType.SOFT_DROP_START),

  softDropEnd: (): SoftDropEndCommand =>
    createCommand<SoftDropEndCommand>(CommandType.SOFT_DROP_END),

  swap: (): SwapPieceCommand =>
    createCommand<SwapPieceCommand>(CommandType.SWAP_PIECE),

  tapBlock: (x: number, y: number): TapBlockCommand =>
    createCommand<TapBlockCommand>(CommandType.TAP_BLOCK, { x, y }),

  pause: (): PauseCommand =>
    createCommand<PauseCommand>(CommandType.PAUSE),

  resume: (): ResumeCommand =>
    createCommand<ResumeCommand>(CommandType.RESUME),

  restart: (): RestartCommand =>
    createCommand<RestartCommand>(CommandType.RESTART),
};
