# Glimpse V0.1 UI Prototype Notes

Prototype question:

Can a SQL editor-first interface keep AI assistance, Auto Table Discovery, Query Session history, Read-only execution, and SQL repair visible without turning Glimpse into a chat-first product?

How to run:

```bash
cd /Users/weideng/Projects/pri/glimpse/prototypes/glimpse-v0.1-ui
python3 -m http.server 4173
```

Open:

- `http://localhost:4173/?variant=A`
- `http://localhost:4173/?variant=B`
- `http://localhost:4173/?variant=C`

Variants:

- `A - Workbench`: classic three-pane developer workbench.
- `B - Command Deck`: command-first top band with focused editor/results split.
- `C - Session Timeline`: session history and query lifecycle are the primary organizing surface.

Throwaway rule:

This prototype should be deleted or absorbed after the team chooses the interaction direction. It is not production code and has no real database or AI integration.

Initial observations:

- Variant A is the most literal implementation of the current PRD: database/session context on the left, SQL/results in the center, AI and Candidate Table Set on the right. It is likely the safest baseline.
- Variant B makes natural-language command entry more prominent, which feels efficient, but risks pulling the product toward chat-first if the AI band becomes too dominant.
- Variant C makes Query Session lifecycle very clear and may help history/repair flows, but catalog inspection becomes less immediate.
- The Candidate Table Set needs to stay close to both the AI Assistant Panel and the SQL editor. If it moves too far away, automatic table discovery becomes hard to trust.
- The Result Table needs a compact execution metadata strip. It reinforces that result rows are visible but not persisted.

Possible GitHub issue adjustments:

- #2 can stay as the shell issue, but its acceptance criteria should explicitly mention the SQL editor/results area and AI support panel proportions after a variant is chosen.
- #7 and #8 are tightly coupled in the UI because table discovery naturally flows into SQL generation; keep them separate for implementation, but validate them together in review.
- #10 should include the warning strip and manual execution affordance as visible UI states, not only validator behavior.
- #11 should explicitly include result metadata visibility next to the Basic Result Table.
- #13 should include a session lifecycle or timeline view only if Variant C wins; otherwise keep it as a simpler history list.
