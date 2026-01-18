
import { useEffect } from 'react';
import { gameEventBus } from '../core/events/EventBus';
import { GameEventType, PopPayload, GoalCapturePayload } from '../core/events/GameEvents';
import { audio } from '../utils/audio';

export const useAudioSubscription = () => {
    useEffect(() => {
        const unsubMove = gameEventBus.on(GameEventType.PIECE_MOVED, () => audio.playMove());
        const unsubRotate = gameEventBus.on(GameEventType.PIECE_ROTATED, () => audio.playRotate());
        const unsubDrop = gameEventBus.on(GameEventType.PIECE_DROPPED, () => audio.playDrop());
        
        const unsubPop = gameEventBus.on<PopPayload>(GameEventType.GOOP_POPPED, (payload) => {
            audio.playPop(payload?.combo || 0);
        });
        
        const unsubReject = gameEventBus.on(GameEventType.ACTION_REJECTED, () => audio.playReject());
        
        const unsubGoal = gameEventBus.on<GoalCapturePayload>(GameEventType.GOAL_CAPTURED, (payload) => {
            audio.playPop(10); // Celebration pop for goal
        });
        
        const unsubGameOver = gameEventBus.on(GameEventType.GAME_OVER, () => {
            audio.playGameOver();
            audio.stopMusic();
        });

        const unsubMusicStart = gameEventBus.on(GameEventType.MUSIC_START, () => audio.startMusic());
        const unsubMusicStop = gameEventBus.on(GameEventType.MUSIC_STOP, () => audio.stopMusic());
        const unsubGameResumed = gameEventBus.on(GameEventType.GAME_RESUMED, () => {
            audio.resume();
            audio.startMusic();
        });

        return () => {
            unsubMove();
            unsubRotate();
            unsubDrop();
            unsubPop();
            unsubReject();
            unsubGoal();
            unsubGameOver();
            unsubMusicStart();
            unsubMusicStop();
            unsubGameResumed();
        };
    }, []);
};
