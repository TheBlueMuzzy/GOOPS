/**
 * EventBus.ts - Synchronous publish/subscribe event system
 *
 * Simple event bus for decoupling game systems from side effects.
 * Audio, UI updates, and analytics subscribe to events.
 *
 * C# Note: Maps to C# events or a simple observer pattern.
 */

import { AnyGameEvent, GameEventType } from './GameEvents';

type EventHandler<T extends AnyGameEvent = AnyGameEvent> = (event: T) => void;

interface Subscription {
  id: number;
  type: GameEventType | '*';
  handler: EventHandler;
}

export class EventBus {
  private subscriptions: Subscription[] = [];
  private nextId = 1;
  private eventQueue: AnyGameEvent[] = [];
  private isProcessing = false;

  /**
   * Subscribe to a specific event type
   */
  on<T extends AnyGameEvent>(
    type: T['type'],
    handler: EventHandler<T>
  ): () => void {
    const id = this.nextId++;
    this.subscriptions.push({
      id,
      type,
      handler: handler as EventHandler,
    });

    // Return unsubscribe function
    return () => this.off(id);
  }

  /**
   * Subscribe to all events
   */
  onAll(handler: EventHandler): () => void {
    const id = this.nextId++;
    this.subscriptions.push({
      id,
      type: '*',
      handler,
    });

    return () => this.off(id);
  }

  /**
   * Unsubscribe by ID
   */
  private off(id: number): void {
    this.subscriptions = this.subscriptions.filter(s => s.id !== id);
  }

  /**
   * Emit an event synchronously to all subscribers
   */
  emit(event: AnyGameEvent): void {
    // Process immediately (synchronous)
    for (const sub of this.subscriptions) {
      if (sub.type === '*' || sub.type === event.type) {
        try {
          sub.handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
      }
    }
  }

  /**
   * Emit multiple events
   */
  emitAll(events: AnyGameEvent[]): void {
    for (const event of events) {
      this.emit(event);
    }
  }

  /**
   * Clear all subscriptions (useful for cleanup)
   */
  clear(): void {
    this.subscriptions = [];
  }

  /**
   * Get count of active subscriptions (for debugging)
   */
  get subscriptionCount(): number {
    return this.subscriptions.length;
  }
}

// Singleton instance for the game
let globalEventBus: EventBus | null = null;

export function getEventBus(): EventBus {
  if (!globalEventBus) {
    globalEventBus = new EventBus();
  }
  return globalEventBus;
}

export function resetEventBus(): void {
  if (globalEventBus) {
    globalEventBus.clear();
  }
  globalEventBus = new EventBus();
}
