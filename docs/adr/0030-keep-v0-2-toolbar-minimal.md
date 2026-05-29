# Keep V0.2 toolbar minimal

Glimpse V0.2 will keep fixed toolbar actions limited to Data Source Management, Model Provider Management, New Console, Preferences, and SQL Run. The workbench should not add decorative DataGrip-style toolbar buttons for DDL, table views, sync, refresh, or similar database IDE actions before those behaviors are in scope.

## Considered Options

- Mirror a full database IDE toolbar: familiar visually, but creates unsupported affordances and scope creep.
- Keep only confirmed V0.2 commands: clearer for implementation and testing while preserving the core workbench loop.
- Hide most actions in menus: compact, but makes first-use setup and console creation less discoverable.

## Consequences

Toolbar tests should assert the presence of confirmed commands rather than screenshot-inspired placeholders. Additional database IDE actions can be introduced later as real capabilities with defined behavior.
