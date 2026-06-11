---
name: Orval update category types
description: Orval generates specific named union types for update mutation category fields; simple string casts fail typecheck.
---

When Orval generates update mutation types (e.g. `AssetUpdate`, `LiabilityUpdate`), the `category` field becomes a named union type like `AssetUpdateCategory` rather than a plain `string`. Casting with `as EntityRow["category"]` (where `EntityRow` is a local type with `category: string`) will not satisfy the generated type.

**Fix:** Cast directly to the full literal union, e.g.:
```ts
category: (editForm.category || fallback) as "cash"|"savings"|"land"|"vehicle"|"investment"|"business"|"property"|"other"
```

**Why:** Orval infers the enum from the OpenAPI spec's enum values and creates a named type alias. A local interface with `category: string` is too wide to satisfy it.

**How to apply:** Any time you write an update mutation call where category is set from a form string variable, use an explicit literal union cast matching the OpenAPI enum values for that field.
