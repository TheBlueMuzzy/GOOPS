
export enum GameEventType {
    // Gameplay
    PIECE_MOVED = 'PIECE_MOVED',
    PIECE_ROTATED = 'PIECE_ROTATED',
    PIECE_DROPPED = 'PIECE_DROPPED', // Hard drop landing
    GOOP_POPPED = 'GOOP_POPPED',
    ACTION_REJECTED = 'ACTION_REJECTED',
    GAME_OVER = 'GAME_OVER',
    GOAL_CAPTURED = 'GOAL_CAPTURED',
    
    // Complications
    COMPLICATION_SPAWNED = 'COMPLICATION_SPAWNED',
    COMPLICATION_RESOLVED = 'COMPLICATION_RESOLVED',
    
    // System / UI
    GAME_START = 'GAME_START',
    GAME_PAUSED = 'GAME_PAUSED',
    GAME_RESUMED = 'GAME_RESUMED',
    GAME_EXITED = 'GAME_EXITED',
    
    // Music Control
    MUSIC_START = 'MUSIC_START',
    MUSIC_STOP = 'MUSIC_STOP'
}

export interface PopPayload {
    combo: number;
    count: number;
}

export interface GoalCapturePayload {
    count: number;
}
