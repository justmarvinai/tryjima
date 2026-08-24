/**
 * The Jima UI kit — one set of primitives for the landing, Jima Captions and
 * Jima Motion. Import from "@/ui", never from the individual files, so a
 * component can be moved or split without touching call sites.
 */
export { cn } from "./cn";
export { Button, IconButton, buttonClasses, type ButtonProps, type ButtonVariant, type ButtonSize } from "./Button";
export { Field, TextInput, TextArea, Select, Segmented, Slider, Switch, Toggle, ColorField, type SelectOption } from "./controls";
export {
  Container,
  WideContainer,
  Card,
  Panel,
  BentoCard,
  Badge,
  SectionHeading,
  Marker,
  MockupFrame,
  EmptyState,
  Kbd,
  TONE_ACCENT,
  type Tone,
  type BadgeTone,
} from "./layout";
export { ProgressBar, Spinner, RouteFallback, Notice } from "./feedback";
export { Reveal } from "./Reveal";
export { useInView } from "./useInView";
export { JimaLogo, JimaMark, Wordmark, ProductLockup } from "./JimaLogo";
export * from "./icons";

export { useReducedMotion } from "./useReducedMotion";
