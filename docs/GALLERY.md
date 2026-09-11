# Screenshot gallery

Captured on 2026-09-11 from the application at source revision `590e64a` and the published generated documentation. These are browser screenshots, not design mockups.

## Capture environment

The application ran in an isolated local test fixture with the real standalone routes and browser assets, local SQLite/object-storage adapters, three eight-second synthetic test-pattern videos and imported synthetic transcript segments. Hosted processing was disabled. The two demo agents have separate identities; the setup drawer was filled but not submitted, so no newly issued key is pictured.

The screenshot session used the normal browser viewport. All captures use the visible viewport. Content below the fold remains available in the application. Images have not been retouched. Media bytes, credentials, local databases and installation identifiers are excluded from the public repository.

## Captures

| File | Surface | What was checked |
| :-- | :-- | :-- |
| [library.jpg](assets/gallery/library.jpg) | Video library | Three synthetic uploads reached ready state and appeared in the real UI |
| [search.jpg](assets/gallery/search.jpg) | Search drawer | The query `launch` returned imported transcript evidence with timestamp links |
| [agents.jpg](assets/gallery/agents.jpg) | Named agent management | Both demo identities and their independent daily limits rendered |
| [agent-access.jpg](assets/gallery/agent-access.jpg) | Agent setup | Purpose, folder assignment and zero-dollar allowance fields rendered; no key was generated in the capture |
| [upload.jpg](assets/gallery/upload.jpg) | Video upload | Video, title, folder and optional caption fields rendered |
| [agent-contract.jpg](assets/gallery/agent-contract.jpg) | Published API/MCP reference | Filtering for `agent_self` displayed the generated identity contract |

## Verification limits

The gallery demonstrates rendered application flows and local keyword retrieval. It does not establish hosted AI accuracy, successful paid processing, physical-device playback or production readiness. The contract screenshot is documentation, not a transcript of an autonomous agent run. See [release status](RELEASE_STATUS.md).

To refresh the gallery, use fresh synthetic fixtures, exercise the actual UI, inspect every image for credentials or private data, and retain these scope notes. Never replace a failed real flow with fabricated results for a screenshot.
