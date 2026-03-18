/**
 * Live Activity type definitions for iOS 16.2+
 *
 * These types define the configuration for config-driven Live Activity generation.
 * Consumers define their Live Activity in shortcuts.config.ts and the library
 * generates all Swift code (SwiftUI views, stub AppIntents for buttons, Widget Bundle).
 */

/** SwiftUI font styles available for layout nodes */
export type LayoutFont =
  | 'largeTitle'
  | 'title'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'caption'
  | 'caption2';

/** SwiftUI color options available for layout nodes */
export type LayoutColor =
  | 'primary'
  | 'secondary'
  | 'red'
  | 'green'
  | 'blue'
  | 'orange'
  | 'white';

/** Alignment options for stack containers */
export type LayoutAlignment = 'leading' | 'trailing' | 'center';

/**
 * Layout node for config-driven SwiftUI generation
 *
 * Nodes form a tree that maps directly to SwiftUI views:
 * - Leaf nodes: text, image, spacer, progress
 * - Container nodes: hstack, vstack, zstack (have children)
 *
 * Text nodes support ${field} interpolation that resolves to
 * context.attributes.data["field"]?.stringValue or context.state.data["field"]?.doubleValue in generated Swift.
 */
export interface LayoutNode {
  /** The SwiftUI view type */
  type: 'text' | 'image' | 'spacer' | 'hstack' | 'vstack' | 'zstack' | 'progress' | 'timer' | 'button';
  /** For text: display string, supports ${field} interpolation */
  value?: string;
  /** For image: SF Symbol name */
  systemImage?: string;
  /** Font style applied via .font() modifier */
  font?: LayoutFont;
  /** Color applied via .foregroundColor() modifier */
  color?: LayoutColor;
  /** Alignment for stack containers */
  alignment?: LayoutAlignment;
  /** Spacing between children in stack containers */
  spacing?: number;
  /** For text: applies .monospacedDigit() modifier for tabular number display */
  monospacedDigit?: boolean;
  /** For progress: field name referencing a 0.0-1.0 value in contentState */
  progressField?: string;
  /** Children for container types (hstack, vstack, zstack) */
  children?: LayoutNode[];

  /** For timer: contentState field name holding the start Date (Unix timestamp) */
  timerStartField?: string;
  /** For timer: contentState field name holding the end Date. If omitted, counts up indefinitely */
  timerEndField?: string;
  /** For timer: count direction. Default: false (counts up) */
  countsDown?: boolean;

  /** For button: identifier of a shortcut (from shortcuts array) to trigger on tap */
  shortcutIdentifier?: string;
  /** For button: button label text */
  title?: string;

  /** Conditional visibility: show this node only when a contentState field matches a value.
   *  Enables runtime control from JS — update contentState to show/hide sections. */
  showWhen?: {
    /** contentState field name to check */
    field: string;
    /** Value to compare against (boolean, string, or number) */
    equals: boolean | string | number;
  };
}

/**
 * Field definition for Live Activity attributes or content state
 */
export interface LiveActivityFieldDef {
  /** The data type of this field */
  type: 'string' | 'number' | 'boolean' | 'date';
  /** Human-readable title for documentation/generation */
  title?: string;
}

/**
 * Complete definition for a single Live Activity
 *
 * Attributes are static (set once at start), contentState is dynamic (updated).
 * Layout defines the SwiftUI views generated for Lock Screen and Dynamic Island.
 */
export interface LiveActivityDefinition {
  /** Unique identifier for this Live Activity type (e.g., 'timerActivity') */
  identifier: string;
  /** Static data set once when the activity starts (e.g., task name) */
  attributes: Record<string, LiveActivityFieldDef>;
  /** Dynamic data that can be updated while the activity is running */
  contentState: Record<string, LiveActivityFieldDef>;
  /** Required: Lock Screen presentation layout */
  lockScreenLayout: LayoutNode;
  /** Optional: Dynamic Island compact presentation */
  dynamicIslandCompact?: {
    leading: LayoutNode;
    trailing: LayoutNode;
  };
  /** Optional: Dynamic Island expanded presentation */
  dynamicIslandExpanded?: {
    leading?: LayoutNode;
    trailing?: LayoutNode;
    center?: LayoutNode;
    bottom?: LayoutNode;
  };
}

/**
 * Data type for Live Activity attribute/state values passed to native
 */
export interface LiveActivityData {
  [key: string]: string | number | boolean | Date | null | undefined;
}

/**
 * Represents a button tap from a Live Activity on the Lock Screen or Dynamic Island.
 *
 * These arrive via `LiveActivities.addEventListener('button', ...)` and are
 * fire-and-forget — there is no `respond` callback (unlike Siri shortcuts).
 */
export interface LiveActivityButtonAction {
  /** The shortcut identifier configured on the button node */
  identifier: string;
  /** Unique nonce for deduplication */
  nonce: string;
}
