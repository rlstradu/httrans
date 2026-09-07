=======================================
Poanda v1.1.0 - PO File Fixes & Modular Codebase
Release Date: September 6, 2026
=======================================

This release fixes three long-standing bugs that corrupted .po files on save,
and reorganises the codebase so future work is easier and safer. The tool looks
and works the same as before.

Bug Fixes
File Header No Longer Lost: Poanda was silently dropping the header block of
every .po file it saved (Project-Id-Version, Language, Plural-Forms, and the
rest). Those lines are now read and written back correctly.

Comments Attached to the Right String: Source references (#: file.php:42) and
other comments were being assigned to the following string instead of their own,
so a saved file pointed translators at the wrong source lines. Each comment now
stays with the string it describes.

Fuzzy Flags Attached to the Right String: For the same reason, the "fuzzy" mark
was moving to the neighbouring string, flagging finished translations for review
and leaving unfinished ones unflagged. Fuzzy marks now stay where they belong.

Multi-line Strings Read Correctly: Strings split across several lines (the usual
way headers and long texts are written) were only partly read. They are now read
in full.

Header Written in Standard Layout: Multi-line values are written the way gettext
and Poedit write them, one chunk per line, instead of a single long line. A file
opened and saved without edits now comes out byte for byte identical.

New Address
Poanda now lives at httrans.org/poanda/. The old address
(httrans.org/poanda.html) still works and redirects here automatically, so
existing links and bookmarks keep working.

Interface
Own Dialogs Instead of the Browser's: Confirmation prompts and the "enter a
filename" box no longer use the grey browser windows. They are now Poanda's own
dialogs, matching the rest of the tool and translated into both languages.
Escape cancels, Enter confirms.

Faster Loading: The logo and favicon are served from httrans.org instead of
being fetched from GitHub on every visit.

Under the Hood
Modular Codebase: Poanda has gone from a single 5,847-line HTML file to a proper
project structure (index.html, css/styles.css, and around two dozen focused
files under js/), making it far easier to maintain and extend.

Automated Tests: The logic that reads and writes PO, JSON, HTML, TBX, TMX and MO
files is now isolated in js/core/ and covered by automated tests, alongside
browser tests for the main workflows. Every bug fixed above has a test that
fails without the fix.

Cleanup: Removed duplicated code that could never run.

=======================================
Poanda v1.0.5 - Mac Compatibility & Segmentation Fixes
Release Date: May 15, 2026
======================================= 


This update focuses on resolving segment formatting issues, improving compatibility with macOS, and introducing a highly requested keyboard shortcut to speed up your translation workflow based on user feedback.

New Features & Improvements
"Copy Source" Shortcut: You can now instantly copy the original source text (msgid) into the translation field (msgstr) using a dedicated keyboard shortcut (Ctrl + Shift + C by default). Using this shortcut automatically triggers the recalculation of statistics and enables the save buttons. This action has also been added to the Shortcuts customization menu in both English and Spanish.

Mac-Friendly Default Shortcuts: We have updated the default keyboard shortcuts for navigating between segments to avoid conflicts with macOS Mission Control. Moving to the next or previous segment now defaults to Ctrl + Shift + Arrow Down and Ctrl + Shift + Arrow Up. (Note: Existing users will need to click "Reset to Defaults" in the Shortcuts menu to apply these new keys).

Bug Fixes & Stability
Disabled Automatic Sentence Segmentation: Addressed a critical issue where auto-segmenting text by sentences caused extra, unwanted spaces to be injected into the final .po file (especially noticeable when dealing with image tags or specific punctuation). Poanda now treats the entire translation unit as a single block, mirroring the exact behavior of standard offline tools like Poedit and strictly preserving the original spacing.

======================================= 
Poanda v1.0.4 - AI Assistant & Dark Mode
======================================= 

Release Date: December 15, 2025

This milestone update introduces PandaBot, a brand-new AI assistant built directly into Poanda to help you translate faster and better. Alongside this major addition, we have implemented a native Dark Mode to reduce eye strain and reorganized the interface to keep your workspace clean and efficient.

New Features & Improvements 
New AI Assistant (PandaBot): You can now access a smart sidekick powered by Google Gemini directly within the editor. PandaBot allows you to chat, ask for translations, or use quick actions (Translate, Improve, Explain, Fix) without leaving your project.

Context-Aware Intelligence: Unlike a generic chatbot, PandaBot is aware of your work. When you ask for help, it automatically considers the previous and next segments for context, strictly adheres to your active Glossary terms, and references Translation Memory matches, ensuring consistent and accurate suggestions.

Native Dark Mode: Save your eyes during late-night sessions with the new Dark Mode. Toggle it via the moon icon (🌙) next to the language selector. We’ve carefully tuned the color palette with deep grays and optimized contrast for buttons, tables, and text inputs to ensure perfect readability.

Streamlined Toolbar: The top menu has been reorganized. Less frequently used utilities (Find & Replace, Shortcuts, Statistics) are now grouped under a new "Tools" dropdown menu, decluttering the main workspace.

Enhanced Search Bar: The "Auto-propagate translations" option has been integrated directly into the Search container to save vertical space, separating it from search filters with a clean visual divider.

New Shortcuts:

Ctrl + Shift + A: Toggles the AI sidebar and smartly manages focus (auto-focusing the chat when opening, and returning focus to your active translation segment when closing).

Ctrl + Alt + I: Instantly inserts the last AI response into your current translation segment.

Refinements & Fixes AI Localization: The entire AI interface (buttons, welcome messages, placeholders, and configuration settings) is fully localized and switches dynamically between English and Spanish based on your interface language preference.

Smart Link Formatting: When the AI provides reference links, they now appear as small, unobtrusive "Source" buttons that open in a new tab, rather than cluttering the chat with long URLs.

Markdown Rendering: AI responses are now properly formatted with lists, bold text, and paragraphs for better readability.

======================================= 
Poanda v1.0.3 - Glossary Visuals & Stability
======================================= 

Release Date: November 24, 2025

This update brings a highly requested feature from SubpandaTM to Poanda: visual glossary aids directly in the editor. We have also focused heavily on stability, specifically addressing issues where save buttons would become unresponsive during long translation sessions or after reloading.

New Features & Improvements
Visual Glossary Matches: Inspired by SubpandaTM, Poanda now displays a yellow badge directly above the translation field whenever terms from your active glossary are detected in the source text. This badge provides an immediate reference of the "Source Term -> Target Term" pair.

Responsive Glossary Labels: The new glossary badge is designed to adapt to content length. Instead of truncating long terms with ellipses (...), the label now wraps text automatically, ensuring that complex terminology is fully visible without hovering.

Bug Fixes & Stability
Persistent Save Functionality: Fixed a critical logic error where the "Save .po File" button (both the main button and the File menu item) would incorrectly disable itself after validating a segment. The editor now uses a more robust check to ensure save options remain available as long as data exists.

Session Restoration Improvements: The backup and restore system now correctly saves and retrieves the active file type (.po vs .json). This ensures that when you reload the page or restore a session, the editor "remembers" exactly which mode you were working in, keeping the correct save buttons enabled.

=======================================
Poanda v1.0.2 - JSON Support & Workflow Enhancements
=======================================

Release Date: October 23, 2025

This release introduces a major new feature: the ability to translate simple key-value JSON files directly within Poanda. Additionally, several workflow enhancements have been added based on user feedback to improve efficiency during translation.

New Features & Improvements
---------------------------
* **Direct JSON File Translation:** Added the capability to load single `.json` files (simple key-value format) via the new "File" > "Load JSON File" menu. Poanda will display the JSON key as the context (`msgctxt`) and the original value as the source text (`msgid`), leaving the translation field (`msgstr`) empty for you to fill in.
* **Save Translations as JSON:** Complementing the loading feature, you can now save your work back into a `.json` file using "File" > "Save JSON File". Poanda will prompt for a filename and export the context (`msgctxt`) as the key and the translated text (`msgstr`) as the value.
* **New "File" Menu:** Introduced a dedicated "File" menu in the top utility bar, organizing file operations. Existing actions ("Load .po", "Save .po", "Convert to .mo") are now accessible here alongside the new JSON options, while the quick access buttons remain on the main interface for convenience.
* **"Copy Original to Translation" Button:** Added a new icon button (copy icon) next to the "Validate" button within each translation segment. Clicking this button instantly copies the full text from the "Original (msgid)" field into the "Translation (msgstr)" field, useful for minor edits or as a starting point. A tooltip clarifies the button's action on hover.

=======================================
Poanda v1.0.1 - UX & Clarity Update
=======================================

Release Date: August 9, 2025

This is a minor update focused on improving the user experience based on initial feedback. The main goal of this release is to make the project creation workflow more intuitive and clear for new users.

Improvements & Fixes
Enhanced 'New Project' Workflow: Addressed a point of confusion for new users. The application now starts with a clearer welcome message explaining that you are already in a new project. Additionally, the 'New Project' button will now always show a confirmation dialog, providing consistent feedback and preventing accidental data loss.

=======================================
 Poanda v1.0.0 - Launch Announcement
=======================================

Release Date: July 28, 2025

Welcome to the first official release of Poanda!

Poanda is a free, offline-first, browser-based tool designed to make editing .po files simple and efficient. It runs entirely in your browser, ensuring your data stays private. This initial release is packed with features to streamline your translation workflow.

---
Key Features
---

### Core Translation Workflow

* **Load & Edit .po Files**: Easily load your .po files via the file dialog or by dragging and dropping them directly into the application.
* **Segment-by-Segment Editor**: A clean, two-column layout to compare the original (msgid) and the translation (msgstr). Support for context (msgctxt) is included.
* **Real-time Statistics**: Keep track of your progress with a live-updating stats bar showing segment completion, total words, translated words, and remaining words.
* **PO to MO Conversion**: Compile your final .po file into a binary .mo file directly in the browser, ready for use.
* **In-File Search**: Quickly search for text within the original or translated segments of your PO file.

### Professional CAT Tool Features

* **Translation Memory (TM)**:
    * Import and export standard TMX files.
    * The TM is automatically populated with your validated translations as you work.
    * Get fuzzy match suggestions (with a similarity score) for the active segment.
    * A diff view highlights the differences between the source text and the TM match.

* **Terminology (Glossary)**:
    * Import and export standard TBX files.
    * Build and maintain a project-specific glossary.
    * Terms from your glossary are automatically highlighted in the current source segment.

### Productivity and Quality of Life

* **Customizable Keyboard Shortcuts**: Speed up your workflow with shortcuts for validating, navigating segments, and inserting TM/Glossory matches. You can customize them and even import/export your configuration.
* **Powerful Find & Replace**: A dedicated modal for finding and replacing text across all translation segments, with support for case sensitivity and regular expressions.
* **Automatic Data Backup**: Poanda automatically saves your entire session (PO file, TM, and Glossary) to your browser's local storage every 10 seconds.
* **Session Restore**: If you accidentally close your browser, Poanda will ask if you want to restore your previous session upon reopening. You can also save/load backups to/from a file.
* **Customizable Interface**: The Terminology and Translation Memory sidebars are fully draggable and resizable to fit your screen and workflow.
* **Multilingual UI**: The Poanda interface is available in both English and Spanish.

### Project Management

* **Poanda Projects (.poanda)**: Save your entire workspace—the .po file, the Translation Memory, and the Terminology—into a single `.poanda` project file (a zip archive).
* **Easy Project Handling**: Start a new project, open an existing one, or save your current work for later.

---
Getting Started
---

1.  Simply open the `poanda.html` file in your web browser.
2.  Drag and drop a `.po` file onto the window or use the "Load .po file" button.
3.  Start translating!

---
Feedback & Contributions
---

This is the very first version, and your feedback is invaluable! If you find any bugs, have feature suggestions, or want to contribute, please feel free to reach out.

Thank you for using Poanda!
