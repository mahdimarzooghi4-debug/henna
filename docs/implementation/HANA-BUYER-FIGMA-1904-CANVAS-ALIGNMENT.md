# Buyer Homepage Figma 190:4 — width/alignment correction

Owner review (2026-11-08) flagged that buyer website header, category strip, hero and categories do not align and appear too wide.

**Reference:** Figma file DVExfCo8ziZnf5ULDTOqer, node 190:4 (1440x3817). Figma main header node 190:7 and category navigation node 190:28 span full width with content aligned to x=80..1360. Hero node 190:45 spans 1440, hero image/text occupy x=80..1360. Popular categories node 190:81 has content x=80..1360. Thus all interactive/content elements must share a 1280px centered canvas with responsive inline gutters; full-bleed background fills remain.

**Implementation:** overrides are confined to the approved buyer landing CSS module. Reuse the same 1280px max and responsive gutter for header, navigation, hero, promotional cards, popular categories and deals; constrain flex/grid children; keep nav horizontally scrollable only when necessary; preserve all existing navigation and data behaviors. Do NOT change copied Figma text, assets, seller/admin pages or business policies. At reference desktop width 1440 the left/right aligned edges must be 80/1360 px. At <=1000px use the existing responsive two-row header and mobile hero layout.

**Verification:** a real built Next.js server plus Chromium measures bounding boxes and horizontal page overflow at widths 1440, 1650, 1100, 900 and 390. This test is part of the Web CI job. Owner visual acceptance in the isolated preview is still required. No production or Stage deployment or PR merge is approved. The previous Render Stage instance points to a different commit (7aa23b1...) and must not be represented as containing this fix.
