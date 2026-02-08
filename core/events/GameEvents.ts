
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
    LIGHTS_FLICKER = 'LIGHTS_FLICKER', // Warning flicker before lights start dimming

    // Active Abilities
    ABILITY_ACTIVATED = 'ABILITY_ACTIVATED',

    // Progression
    MILESTONE_REACHED = 'MILESTONE_REACHED',
    
    // System / UI
    GAME_START = 'GAME_START',
    GAME_PAUSED = 'GAME_PAUSED',
    GAME_RESUMED = 'GAME_RESUMED',
    GAME_EXITED = 'GAME_EXITED',
    
    // Music Control
    MUSIC_START = 'MUSIC_START',
    MUSIC_STOP = 'MUSIC_STOP',

    // Input events (replaces callback prop drilling)
    INPUT_ROTATE = 'INPUT_ROTATE',
    INPUT_DRAG = 'INPUT_DRAG',
    INPUT_SWIPE_UP = 'INPUT_SWIPE_UP',
    INPUT_FAST_DROP = 'INPUT_FAST_DROP',
    INPUT_SWAP = 'INPUT_SWAP',
    INPUT_BLOCK_TAP = 'INPUT_BLOCK_TAP',
    INPUT_SWAP_HOLD = 'INPUT_SWAP_HOLD',  // Keyboard hold-to-swap progress

    // Tutorial events
    TUTORIAL_STEP_TRIGGERED = 'TUTORIAL_STEP_TRIGGERED',
    TUTORIAL_STEP_COMPLETED = 'TUTORIAL_STEP_COMPLETED',
    TUTORIAL_STEP_DISMISSED = 'TUTORIAL_STEP_DISMISSED',
}

export interface PopPayload {
    popStreak: number;
    count: number;
}

export interface GoalCapturePayload {
    count: number;
}

export interface MilestonePayload {
    milestones: number[];  // Array of milestone ranks reached (e.g., [10] or [20, 30])
}

// Input event payloads
export interface RotatePayload {
    clockwise: boolean;
}

export interface DragPayload {
    direction: number;  // 0 = stop, 1 = left, -1 = right
}

export interface FastDropPayload {
    active: boolean;
}

export interface BlockTapPayload {
    x: number;
    y: number;
}

export interface SwapHoldPayload {
    progress: number;  // 0-100, or -1 to indicate cancelled/inactive
}

// Tutorial event payloads
export interface TutorialStepTriggeredPayload {
    stepId: string;       // TutorialStepId
    message: { keywords: string[]; fullText: string };  // IntercomMessage
}

export interface TutorialStepCompletedPayload {
    stepId: string;       // TutorialStepId
}

export interface TutorialStepDismissedPayload {
    stepId: string;       // TutorialStepId
}
