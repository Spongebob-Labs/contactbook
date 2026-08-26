/**
 * The primitive vocabulary (spec §8D.7). Twenty-plus tracks compose these; **no track
 * outside T05 may edit one** (plan §1.2). Need a variant that is not here? That is a
 * `NEEDS_DECISION`, not a local edit.
 *
 * Radix supplies the behaviour — focus management, ARIA, keyboard nav — and 100% of the
 * visual layer is ours against T02's tokens (Q29). Nothing in this directory carries a
 * colour literal (F-01), an elevation (F-09), an oversized radius (F-10) or a type weight
 * above 500 (F-11), and nothing reimplements the global `:focus-visible` ring (§8.3).
 */

export { Button, buttonClassName } from "./button";
export type { ButtonProps, ButtonSize, ButtonVariant, ButtonClassNameOptions } from "./button";

export { Input } from "./input";
export type { InputProps } from "./input";

export { TextArea } from "./textarea";
export type { TextAreaProps } from "./textarea";

export {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectOptionItem,
  SelectSeparator,
} from "./select";
export type { SelectOption, SelectOptionItemProps, SelectProps } from "./select";

export { Checkbox } from "./checkbox";
export type { CheckboxProps } from "./checkbox";

export { RadioGroup } from "./radio-group";
export type { RadioGroupProps, RadioOption } from "./radio-group";

export { Switch } from "./switch";
export type { SwitchProps } from "./switch";

export { Field, Label, controlClassName } from "./label";
export type { FieldChildArgs, FieldProps, LabelProps } from "./label";

export { Chip, chipClassName } from "./chip";
export type { ChipClassNameOptions, ChipProps, ChipSize, ChipTone } from "./chip";

export { Badge } from "./badge";
export type { BadgeProps, BadgeTone } from "./badge";

export { Avatar, monogram } from "./avatar";
export type { AvatarProps, AvatarSize } from "./avatar";

export { Skeleton } from "./skeleton";
export type { SkeletonProps, SkeletonVariant } from "./skeleton";

export { Rule } from "./rule";
export type { RuleProps } from "./rule";
