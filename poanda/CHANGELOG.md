=======================================
Poanda v2.0.0 - From PO Editor to CAT Tool
Release Date: September 7, 2026
=======================================

Poanda opened three file formats, understood none of the codes inside a
segment, destroyed plural forms on save, and had a chat box bolted to the
side. It now opens twenty-seven formats and gives them back byte for byte,
treats placeholders and inline tags the way a CAT tool does, knows in which
direction each project is being translated, and carries an AI assistant that
can be pointed at your own machine. This entry gathers everything done on 6
and 7 September.

New
Twenty-Seven File Formats: Poanda used to open three. It now opens the formats
a translator is actually sent — office documents, the bilingual files of the
big CAT tools, and the resource files of every kind of app.

  Documents      .docx .xlsx .pptx .odt .ods .odp .csv .txt .md .html .epub
  Bilingual      .po .mo .xliff .sdlxliff .mxliff .mqxliff .mqxlz .locversia
  Apps and code  .json .properties .resx .wxl .arb .ts .dita .ditamap
  Layout         .idml

One rule holds across all of them: what you did not translate is not
rewritten. Poanda notes where each piece of text sits in the file you opened
and, on saving, replaces exactly those pieces. Everything else — the parts a
program wrote for another program, and the parts Poanda does not understand —
comes back untouched, because it was never copied. Open a file, save it
without translating, and you get the same file back, byte for byte; there is a
test for each format that says so.

That matters most where the file is more than its text. A .sdlxliff carries
each segment's status, who touched it, the memory match score and the skeleton
of the original document; a .resx carries the schema Visual Studio needs; a Qt
.ts carries the lines of code where each string lives; a .docx is twenty files
of which one holds the text. Rewriting any of those from scratch does not lose
details — it returns a file the other tool no longer accepts.

Office documents: a segment is a paragraph. Word stores a paragraph in pieces,
splitting it wherever the formatting changes, so "press **Save** to finish"
can be five fragments; Poanda joins them so you translate the sentence, not
the fragments — and the formatting comes along as a tag:

  press <b1>Save</b1> to finish

The letter says what it is — b bold, i italic, u underline, g anything else, a
colour or a font or a size — and the number tells one tag from another in the
same paragraph. Put a tag somewhere else in your sentence and the formatting
moves with it, which is what you need when the emphasised word lands in
another place in your language. Delete a tag and you lose that formatting,
nothing else; the file still opens. Word's own internal marks — the
spellchecker's language, the "dirty since last review" flag, font hints for
Asian scripts — are not formatting and do not become tags. A document whose
every word carried a tag would be unusable, and that is the classic failure of
tools that show tags for everything.

Spreadsheets give you one segment per distinct cell text and never touch the
formulas. Presentations give you one per paragraph, slides first and then
their speaker notes, in slide order — not the order the file happens to store
them in.

Bilingual files open with whatever translation they already carried, so you
can pick up work started in another tool, and a Qt file loses its "unfinished"
mark when you translate a string — which is what tells Qt to actually use it.
Projects exported from Locversia open with their segmentation and their notes
intact and can be saved back for Locversia to continue. Twelve of these
formats came from Locversia, whose parsers this borrows from and whose writers
this deliberately does not: they rebuild the file from a template, which is
what the rule above exists to prevent.

The details, format by format. Spreadsheets exported as .csv: Poanda reads the
header row to work out which column is the key, which is the source and which
is the target, in English or in Spanish, and it copes with semicolons and tabs
as well as commas, with quoted cells that contain a line break, and with files
that have no header row at all — where the first row is a string to translate,
not a row to throw away.

Markdown: headings, paragraphs, list items, blockquotes and table cells are
segments; code blocks, front matter and link definitions are not. A paragraph
split over several lines is one segment, and inline code or a link stays
inside its sentence rather than cutting it in two — translating "press", "to
finish" as separate fragments is how a sentence ends up wrong.

.resx (.NET), .arb (Flutter), .ts (Qt Linguist) and .wxl (WiX installers) each
carry a note from the developer, and it goes to the comment icon. Binary
resources in a .resx — an icon, a bitmap — are left alone rather than shown as
segments nobody can translate, and an .arb keeps its @-metadata blocks,
including the placeholders the app needs to compile. Because .ts is also the
extension of TypeScript source code, a .ts file that turns out to be code is
refused with an explanation instead of opening as an empty segment list.

DITA (.dita, .ditamap): titles, paragraphs, list items and task steps are
segments; code blocks are not, and neither are the ids and references that
hold a document set together. The alt text of an image is translated too — it
is what a screen reader says out loud, and it is the thing everyone forgets.

Books (.epub): the text of each chapter and the book's own title and
description, which is what shows up in a reader's library. Italics and links
inside a sentence stay inside the segment. Layout files (.idml): the text of
each InDesign story; frames, styles, pages and linked images are untouched.
Plain text: one segment per line. Java .properties: the key becomes the
segment's context and the value is what you translate.

Adding a format is now a single entry in one table, which is also where the
drop area, the "unsupported file" message and the Open dialog get their list
of extensions from. Those three used to be written out by hand in three
different places — the Open dialog was still offering only the original three
formats, so a file Poanda could open perfectly well appeared greyed out in the
file browser.

Tags and Codes: the bits of a segment that must not be translated — the slots
a program fills in (%s, %1$s, {name}, {{name}}) and the inline tags (<b>, <a
href>) — are now recognised and handled as what they are, the way a CAT tool
does it.

They stand out in the source text instead of hiding inside it. Click one and
it goes into the translation at the cursor, or press Ctrl+Shift+T to drop in
the next one still missing, so you can keep both hands on the keyboard. And
when the translation does not carry the same tags as the source, the row is
marked and a red dot explains what is wrong: one missing, one too many, the
order swapped, a pair left open. An untranslated segment is never marked — an
editor full of red dots the moment you open a file is an editor nobody reads.

They are yellow in the translation too, not only in the source, and they
behave as one piece there: press backspace on a tag and the whole thing goes,
the way Trados and memoQ do it. There is no way left to end up with half an
"<a hre=", which breaks a file exactly as thoroughly as a missing tag but does
not show when you read the translation back. Typing inside a tag moves the
cursor out instead of splitting it, and a selection that cuts a tag in half is
widened to take the whole tag before anything is deleted.

Two things this deliberately does not do. It does not turn the translation box
into something other than a plain text field, so accents and Asian input
methods type exactly as they always did — rebuilding the field while an accent
is being composed is what turns "é" into a stray "´", and it is where a tag
editor usually goes wrong. And it does not fake the edit: the browser still
performs it, so undo keeps working.

Each format is read on its own terms: printf markers and braces in .po files,
i18next and ICU placeholders in .json, inline tags in .html.

One Language Pair, Chosen Once: a file is translated in one direction, and
everything in Poanda needs to know which — the memory, to know which units
apply; the glossary, to know which column is the term and which the
translation; the assistant, to know what it is being asked for; and you, so
you do not spend half a day translating into European Portuguese a job that
was for Brazil. That direction is now a property of the project, asked for
when you open the file and kept with it. Reopen the project from Recent
Projects a week later and the pair is still there.

The dialog comes pre-filled with whatever the file itself declares — the
Language: header of a .po, the source-language and target-language of an
XLIFF, the sourcelanguage of a Qt .ts, the @@locale of an .arb — or, failing
that, with the language in the file name (Strings.es-ES.resx, app_pt_BR.arb)
and then with the last pair you used. It is asked every time even when the
file declares it, because a .po reused from a previous job carries the
previous job's header more often than anyone would like, and finding that out
when you open the file costs one click while finding out when you deliver it
costs the job.

The pair sits at the right-hand end of the search bar, above the segments,
reading "en-US → pt-BR" behind its own heading. Click it to change it at any
point: getting it wrong when you open a file happens, and having to reopen the
file to fix it would be a penance that fixes nothing. The pair also travels
inside an exported .poanda project, so a project sent to somebody else arrives
knowing what it is.

The glossary and the memory no longer ask for languages. They used to have a
configuration screen each, before you could use them at all — the same fact
written in two places, and the two could disagree. Both panels now show the
project's pair, and clicking it opens the same dialog. Projects saved before
this change are asked once, the first time you reopen them. And because the
memory now takes its languages from the project rather than from the TMX file,
matching compares the language and not the whole tag: a memory exported from
another tool as "en-US" is used in a project set to "en". Before, they had to
match letter for letter or the whole memory sat there unused.

The language fields used to be text boxes that suggested codes as you typed,
from a list of 47. There is now a dropdown with the full ISO 639-1 set —
around two hundred — plus the regional variants that are actually commissioned
separately: es-ES and es-MX, pt-BR and pt-PT, en-US and en-GB, fr-CA, zh-Hans
and zh-Hant, sr-Latn. Each shows its name and its code ("Brazilian Portuguese
(pt-BR)"), because in this trade work is commissioned by code, and the names
come out in whichever language Poanda is set to. Tags written any of the ways
files write them — es_ES with an underscore, PT-br with the case reversed,
en_US.UTF-8 with the encoding stuck on the end — are all read as the same
code.

An Assistant Worth the Name: the AI panel was a chat box wired to one service
with one key. It is now a working part of the tool.

Four ways to connect: Google Gemini, OpenAI, Anthropic (Claude), and anything
that speaks OpenAI's format — which is what Ollama, LM Studio and llama-server
speak, and half the paid services too. Choosing the last one and pointing it
at your own computer is all it takes to run the assistant on a local model,
with no key, no cost and nothing leaving your machine. Poanda calls the
service directly from your browser with your key; there is no server of ours
in the middle, which is the point: your clients' text does not pass through a
machine we own.

One button does the connecting and the saving, and it only saves once the
service has answered — which is what prevents the worst case, a mistyped key
sitting there quietly until it fails halfway through a thousand-segment
pre-translation. Once connected, the panel says what it is connected to, and a
Change service button takes you back: going from Gemini to OpenAI is three
clicks and a paste, and the key you had stays where it was in case you change
your mind. Connecting also fills a dropdown with the models that service
actually has, newest first and the newest one selected, so nobody has to type
a model name from memory. Order comes from the date the service gives, and
where there is no date, from the version number in the name. Preview and
experimental models sort behind the finished ones of the same version, and
models that cannot hold a conversation — embeddings, speech, transcription,
image, moderation — are left out of the list altogether.

Your key is kept only for the session unless you tick "remember on this
computer", each service keeps its own, and it is never written into a project
file or a backup — a .poanda gets emailed around, and a key inside one is
somebody else's bill waiting to happen. It is stored unencrypted, because
there is no honest alternative in a tool with no server: encrypting it would
mean keeping the key to the encryption in the same browser. Any existing
Gemini key is carried over automatically.

Tags the AI cannot break: this is the part that makes AI translation safe to
use on real files. The model is never shown your placeholders. Before the text
is sent, every %s, {name} and <b> is swapped for a marker of Poanda's own;
when the answer comes back they are put where the model left the markers. If
any is missing, duplicated, invented or half-written, the translation is
thrown away rather than saved. A segment left blank is visible in the list and
in the statistics; a segment that quietly breaks the file is not. The same
check catches a model that returns the source untranslated, an empty answer,
or one that starts explaining itself instead of translating.

The assistant answers questions with no file open — terminology, background
reading on the subject you are translating, alternatives for a phrase — and it
remembers the conversation, so "and in Latin America?" works as a follow-up.
When you are inside a segment it uses what is around it: the glossary terms
that appear in that segment, what your memory says about it, and the segments
before and after. Not the whole glossary and the whole memory — sending more
costs more, runs slower and, against intuition, translates worse, because what
matters gets diluted. If nothing is configured yet, opening the assistant
opens its settings instead of a chat box that could only answer with an error.

Pre-translate the whole file, from the Tools menu, with two engines to choose
from and the difference explained where you choose. Fast is your browser's own
translator: local, free, no key, no waiting, and the file never leaves your
computer, but it does not follow your glossary or your instructions — machine
translation for a first pass, Chrome and Edge only, and not offered where it
is not available. With context is your AI, with your glossary, your memory and
your instructions; slower, and it costs money if the service is a paid one.

Before spending a single call it resolves what it can on its own: repeated
segments are translated once and copied, exact matches from your memory are
taken from there, and what is not language at all — a URL, an email address, a
number — is copied across. In a software file that is often a third of the
work, free and instantly. The rest goes out ten segments per request and
several requests at a time, which is the difference between twenty minutes and
an afternoon. Only empty segments are touched: what you translated yourself is
left exactly as it is, including what you typed in the seconds before
starting. Everything the AI writes is marked as a draft — a mark on the row,
not validated, visible at a glance — and validating it by hand is what turns
it into your translation and clears the mark. A file where you cannot tell
reviewed work from machine output is a file you cannot trust.

Segment Comments: a speech bubble next to "copy source" holds the notes that
came with the segment — the developer's note in a .po file ("max 20
characters", "this is a button"), a note left by whoever translated before
you, a comment written above a key in a .properties file, the <comment> of a
.resx, the description of an .arb. It lights up on the rows that have
something to say and stays dim on the rest, so you can see at a glance where
to slow down. Hover it for a short note, click it for a long one.

You can write your own comment there too: a question for the client, a
decision you want to remember, a note for whoever reviews. Clicking the bubble
unfolds a small box directly under the segment's row — not a dialog in the
middle of the screen, on top of the very text the comment is about — with the
note from the file above it and three buttons: Save, Delete and Cancel.
Ctrl+Enter saves, Escape closes without saving, and Delete only appears once
there is a note to delete. Only one box is open at a time. The comment is
saved with the project and never written into the file, so the file you hand
back is exactly the file you were sent.

Notes used to be crammed into the grey context label together with the file
references, which mixed up two different things: a reference tells you which
segment this is and is read in a glance, while a note tells you how to
translate it and has to be read properly. The label now carries only the
context and the references. Markers that belong to the PO format itself —
fuzzy, the previous source text, obsolete strings — are shown in neither,
since they are syntax, and fuzzy already has its own badge.

Recent Projects: Poanda remembers the files you have been working on. Open
Project > Recent Projects and your last five files are there, each with how
far along it is and when you last touched it, ready to carry on. Close the
browser, come back tomorrow, pick up where you left off, without hunting for
the original file. Removing a project only clears Poanda's copy in this
browser; the file on your computer is untouched. Everything stays on your
computer, as always. Nothing is uploaded anywhere.

Drop Area and a Simpler File Menu: the empty editor is now a place to drop
files. Drag a file onto it, or click it to pick one from your computer. It
lists the formats Poanda understands, grouped — documents, bilingual, apps and
code, layout — with each extension saying what it is when you hover it,
because ".arb" or ".wxl" mean nothing to someone who does not work with them,
and that is half the list. In the menu, "Load file" replaces the three
separate load entries and accepts any supported format, "Save file" writes the
file back in the format you opened, and "Convert to .mo" only appears once a
.po file is open, since it means nothing for the other formats.

New Address: Poanda now lives at httrans.org/poanda/. The old address
(httrans.org/poanda.html) still works and redirects here automatically, so
existing links and bookmarks keep working.

Changed
A Compact Editor: every segment is now a single row — number, source,
translation and a tick to validate — instead of a block with two headings, two
framed boxes, a line of counts and three buttons. The text is smaller and all
the rows are the same shape, so a laptop screen holds several times as many
segments and the eye can run down the list without tripping over blocks of
different sizes. The character counts moved inside their own column, bottom
right, showing just the number; hover one to read what it counts. "Validate"
and "Edit" are now one tick at the far right of the row.

The segment list reaches the bottom of the window. It had a fixed ceiling of
70% of the window height minus 50 pixels, which left an empty white band below
it whether the file had three segments or three thousand — right after the
rows had been made compact so that more would fit. The list now takes whatever
height is left, which is around a third more segments in view, and what
scrolls is the list itself, so the toolbar and the search bar stay where they
are while you work.

Poanda also fills the browser window: the white panel used to sit on a grey
background with a margin all around it, and that margin now goes to the
editor. The editor starts at the top rather than centred vertically. Once a
file is open, the large logo and the description step out of the way and the
logo comes back small in the top-left corner; start a new project and the full
header returns. The description now says what Poanda actually is: a very
simple CAT tool for translators, built by a fellow translator who loves
pandas.

One Type Scale Everywhere: the editor went down to 14 px, but every window,
panel and menu stayed at the sizes Tailwind gives by default — 20 px headings
on 16 px body — so opening a dialog over the editor felt like switching to
another program. Everything now uses one scale of three steps: 16 px for the
title of a window, 14 px for text, 12 px for counts, labels and notes. There
were eleven different sizes scattered through the stylesheet before this; they
now live in one place, so the whole tool can be re-tuned by editing three
lines, and they no longer depend on the Tailwind CDN having loaded.

Dark Mode, Properly: colours that were only ever chosen against white have
been reworked for the dark theme. The brand pink and yellow step down to their
deeper shades so a hairline like the active segment border no longer glares.
Search highlights, added and removed text, the best translation-memory match,
the drop area and the loading overlay all get muted dark backgrounds with
light text of the same colour. Both logos carry dark text drawn for a white
background, so they now get a white outline in dark mode rather than
disappearing into it.

A Tidier Toolbar: language, theme and version moved into the toolbar instead
of floating above the panel, and the three now look like one another — same
height, same border, same lettering. They used to be a menu, an emoji in a
circle and a grey label, each from a different era of the tool. The theme
button says where it takes you, "Dark mode" or "Light mode", instead of a sun
or a moon: two small pictures that look alike never made it clear whether they
meant the mode you were in or the one you were going to. The language selector
is a single menu listing "English" and "Español" written in their own
language, with a tick on the one in use. Backup moved into the File menu,
where saving and loading already were, with the green "there is a backup" dot
on that entry.

Poanda's Own Dialogs: confirmation prompts and the "enter a filename" box no
longer use the grey browser windows. They are Poanda's own, matching the rest
of the tool and translated into both languages. Escape cancels, Enter
confirms.

A Readable Changelog: this window used to show the file exactly as written,
which made a wall of text where you could not tell one version from the next.
Each version now has its title and date, each section its heading, and each
entry is a bullet with its name in bold.

Storage That Can Be Trusted: the automatic backup runs on Dexie, a well-tested
library for browser storage, instead of hand-written code that fired off saves
without waiting for them to finish — so a failed save was reported only to the
browser console and never surfaced. Sessions in progress when this arrived are
kept: the storage has the same name, version and layout it had before, and
there are tests that write a session the old way and check the new code reads
it back intact. On top of that, each segment is saved on its own: translating
one string in a file of three thousand writes one row, not three thousand.

Fixed
Plural Forms Were Being Destroyed: almost every real file has them — "1 file"
/ "%d files" — and Poanda did not understand them. That did not mean leaving
them alone; it meant deleting them. Opening a file and saving it wiped out the
msgid_plural and every translation already done for each form, leaving one
empty msgstr behind. Work was lost with nothing said about it.

They are now read, translated and written back. Each form gets its own row,
labelled [0], [1], [2] as the file labels them, showing the singular for the
first and the plural for the rest. How many forms there are comes from the
file header, because it depends on the language: one in Japanese, two in
Spanish, three in Polish, six in Arabic. Where the header does not say, Poanda
keeps exactly the forms the file brought and invents none — adding one to a
language that has a single form would break the file just as surely. Saved
projects keep them too, and .mo compilation picks them up.

Three Ways a .po File Was Corrupted on Save: the header block of every .po
file (Project-Id-Version, Language, Plural-Forms and the rest) was silently
dropped. Source references (#: file.php:42) and other comments were assigned
to the following string instead of their own, so a saved file pointed
translators at the wrong source lines. The "fuzzy" mark moved to the
neighbouring string for the same reason, flagging finished translations for
review and leaving unfinished ones unflagged. Strings split across several
lines were only partly read. And the header is now written the way gettext and
Poedit write it, one chunk per line.

JSON Files Came Back Flattened: the JSON reader only understood flat files.
Translation files for web and mobile apps are almost always grouped by screen
or section — "menu": { "save": "Save" } — and that grouping was lost on
saving: the file came back with the keys loose, reordered alphabetically, and
with anything that was not a string dropped. An app cannot read a file like
that, and nobody finds out until someone installs it. Poanda now reads nested
keys, names each segment by its full path ("menu.save"), and returns the file
with its groups, its order, its indentation and its non-text values exactly as
they were.

HTML Pages Came Back Rewritten: the page used to be re-serialised from the
browser's own parser, so the saved file differed from the original in
thousands of lines — different indentation, different attribute order,
different quotes — even if you translated two sentences. And the parsed
document lived only in memory: reopen the project from the recents list and
exporting silently stopped working. Now only the translated text changes, and
a project reopened days later exports fine, including projects saved before
this version.

Validating a segment right after typing it did not put it into the translation
memory. The editor waits a few tenths of a second before committing what you
type, so as not to do arithmetic on every keystroke, and validating is exactly
the thing you do immediately after typing: the last thing written fell into
that gap. That segment then never came back as a match, and there was no way
to tell why.

Several labels were unreadable in light mode. They were painted with the
variable Poanda uses for borders, which is very nearly white on a white
background: the Source Language and Target Language labels of the languages
dialog, the labels of the AI settings panel, the buttons of the comment box,
the note carried over from the file, and the language pair itself. Dark mode
hid the mistake, because that same variable is a dark grey there.

The translation memory panel used to open with "Create a new TM or import a
TMX file to start working", which sent you looking for a button there is no
need to press: the memory exists from the moment you open the file, it is
simply empty. Both panels now say so while they are empty, and say what
actually fills them.

A .po file was not recording its own format when opened, so anything that
behaves differently per format had to guess. Everything that mattered guessed
correctly except the AI, which would not recognise %s as a placeholder in a
.po file — exactly where placeholders live.

Dark mode scrollbars stayed white, because a browser paints those itself and
only listens to the document root. It is told now, so they darken with
everything else, along with checkboxes and other controls the browser draws.

The changelog window is narrower than the file it reads, so every line was
being broken twice and the text came out as a parade of two-word rows. The
paragraphs are joined before being shown, and the window decides where to
break them.

A translation box could open two lines tall when one line was enough, because
of how its height was measured. Every row now starts at the height of its own
text.

A source string containing HTML was being put on the page as HTML, so a msgid
with <b> in it came out in bold instead of showing the tag you were supposed
to copy. It is escaped now, as it always should have been.

A confirmation dialog launched from another window — deleting the local backup
from the backup menu, for instance — appeared behind it: visible but
impossible to click. It now opens on top.

The file header was being counted as a translatable string in the recent
projects list, which made a fresh file look partly translated. It is now
excluded, matching what the Statistics panel has always shown.

Under the Hood
Poanda has gone from a single 5,847-line HTML file to a proper project
structure: index.html, css/styles.css, and around forty focused files under
js/, with everything that reads and writes a file format isolated in js/core/
where it can be tested without a browser. That logic is covered by 451
automated tests, with 221 more driving the tool in a real browser for the main
workflows. Every bug listed above has a test that fails without its fix, and
every format has a test that opens a file, saves it untranslated and compares
the bytes.

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
