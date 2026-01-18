
export type Handler<T = any> = (payload?: T) => void;

export class EventBus {
    private handlers: Map<string, Set<Handler>> = new Map();

    on<T>(event: string, handler: Handler<T>): () => void {
        if (!this.handlers.has(event)) {
            this.handlers.set(event, new Set());
        }
        this.handlers.get(event)!.add(handler);
        return () => this.off(event, handler);
    }

    off(event: string, handler: Handler) {
        this.handlers.get(event)?.delete(handler);
    }

    emit(event: string, payload?: any) {
        this.handlers.get(event)?.forEach(h => h(payload));
    }
}

export const gameEventBus = new EventBus();
