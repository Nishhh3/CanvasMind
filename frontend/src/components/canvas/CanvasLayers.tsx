"use client";

import type { ReactNode, RefObject } from "react";
import type { CanvasHandlers } from "./useCanvasEngine";

type CanvasLayersProps = {
    bgRef: RefObject<HTMLCanvasElement | null>;
    drawRef: RefObject<HTMLCanvasElement | null>;
    width: number;
    height: number;
    cursor: string;
    handlers: CanvasHandlers;
    children?: ReactNode;
};

/**
 * Two stacked canvases (background below, drawing above) plus an overlay slot for HTML controls.
 * Canvas backing-store sizes are set imperatively by useCanvasEngine, never through JSX attributes.
 */
export function CanvasLayers({ bgRef, drawRef, width, height, cursor, handlers, children }: CanvasLayersProps) {
    return (
        <div
            className="relative m-auto shrink-0 overflow-hidden rounded-card bg-white shadow-soft ring-1 ring-line"
            style={{ width, height }}
        >
            <canvas ref={bgRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
            <canvas
                ref={drawRef}
                role="img"
                aria-label="Drawing canvas. Use the toolbar to choose a tool, then draw with a mouse, finger or pen."
                className="absolute inset-0 h-full w-full select-none"
                style={{ touchAction: "none", cursor }}
                onContextMenu={(e) => e.preventDefault()}
                {...handlers}
            />
            {children}
        </div>
    );
}