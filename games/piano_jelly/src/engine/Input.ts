/**
 * Polled input: query `isDown`, `wasPressed`, `wasReleased` from systems.
 * Edge states are cleared at the end of every frame by the engine.
 */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private released = new Set<string>();

  /** Accumulated pointer drag since last frame, in CSS pixels. */
  readonly drag = { x: 0, y: 0 };
  pointerDown = false;

  private listeners: Array<() => void> = [];
  private gestureCallbacks: Array<() => void> = [];

  constructor(element: HTMLElement) {
    this.on(window, 'keydown', (e: KeyboardEvent) => {
      if (e.code === 'Space') e.preventDefault();
      if (!e.repeat) {
        this.down.add(e.code);
        this.pressed.add(e.code);
      }
      this.fireGesture();
    });
    this.on(window, 'keyup', (e: KeyboardEvent) => {
      this.down.delete(e.code);
      this.released.add(e.code);
    });
    this.on(window, 'blur', () => {
      for (const code of this.down) this.released.add(code);
      this.down.clear();
      this.pointerDown = false;
    });
    this.on(element, 'pointerdown', (e: PointerEvent) => {
      this.pointerDown = true;
      element.setPointerCapture(e.pointerId);
      this.fireGesture();
    });
    this.on(element, 'pointermove', (e: PointerEvent) => {
      if (!this.pointerDown) return;
      this.drag.x += e.movementX;
      this.drag.y += e.movementY;
    });
    const up = () => (this.pointerDown = false);
    this.on(element, 'pointerup', up);
    this.on(element, 'pointercancel', up);
  }

  isDown(code: string) {
    return this.down.has(code);
  }
  wasPressed(code: string) {
    return this.pressed.has(code);
  }
  wasReleased(code: string) {
    return this.released.has(code);
  }

  /** Runs once on the first user gesture (needed to unlock audio). */
  onFirstGesture(cb: () => void) {
    this.gestureCallbacks.push(cb);
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.drag.x = 0;
    this.drag.y = 0;
  }

  dispose() {
    for (const off of this.listeners) off();
    this.listeners = [];
  }

  private fireGesture() {
    const cbs = this.gestureCallbacks;
    this.gestureCallbacks = [];
    for (const cb of cbs) cb();
  }

  private on<E extends Event>(target: EventTarget, type: string, fn: (e: E) => void) {
    const handler = fn as EventListener;
    target.addEventListener(type, handler, { passive: false });
    this.listeners.push(() => target.removeEventListener(type, handler));
  }
}
