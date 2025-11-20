<!-- 49ac4021-897e-49e5-81ed-d7a1b5b96340 f8a04639-465c-438a-8dda-1d50f3e1d677 -->
# Transform Notes System to Evernote Advanced

## Current State Analysis

- Basic note creation with voice transcription
- Simple card-based list view
- Tags support in DB but not used in UI
- No editing capability (only create/delete)
- No organization (notebooks/stacks)
- No rich text editor
- No attachments
- No search functionality
- No templates or version history
- Notes and Tasks are combined in one tab ("Notes & Tasks")

## Structural Changes Required

**Files to modify:**

- `src/components/Layout.tsx` - Add new "Notes" tab, rename "Notes & Tasks" to "Tasks"
- `src/components/modules/NotesModule.tsx` - Split into TasksModule (tasks only) and NotesModule (notes only)
- `src/components/modules/TasksModule.tsx` (new) - Extract tasks functionality from NotesModule

**Changes:**

1. Create new top-level "Notes" tab in Layout (similar to Budget Buddy)
2. Rename current "Notes & Tasks" tab to just "Tasks"
3. Remove all notes-related functionality from TasksModule
4. Create dedicated NotesModule with all Evernote features
5. Update tab icons and styling appropriately

## Implementation Plan

### 1. Database Schema Enhancements

**File: `supabase/migrations/[timestamp]_enhance_personal_notes.sql`**

- Add `title` field (currently only has content)
- Add `notebook_id` (UUID, references notebooks table)
- Add `is_pinned` (boolean)
- Add `is_favorite` (boolean)
- Add `reminder_date` (timestamp)
- Add `version` (integer, for version history)
- Create `notebooks` table (id, user_id, name, color, icon, parent_stack_id, created_at, updated_at)
- Create `stacks` table (id, user_id, name, created_at, updated_at)
- Create `note_attachments` table (id, note_id, file_url, file_name, file_type, file_size, created_at)
- Create `note_versions` table (id, note_id, content, title, tags, version, created_at)
- Create `note_templates` table (id, user_id, name, content, tags, created_at)
- Create `note_shares` table (id, note_id, shared_with_user_id, permission, created_at)
- Add full-text search index on content and title
- Add indexes for tags, notebooks, search performance

### 2. Rich Text Editor Implementation

**Files:**

- `src/components/notes/RichTextEditor.tsx` (new)
- `src/components/notes/CreateNoteDialog.tsx` (update)
- `src/components/notes/EditNoteDialog.tsx` (new)

- Integrate a rich text editor (TipTap or similar)
- Support formatting: bold, italic, underline, headings, lists, links, code blocks
- Support tables, images, checkboxes
- Auto-save drafts
- Markdown support

### 3. Notebooks & Stacks Organization

**Files:**

- `src/components/notes/NotebooksSidebar.tsx` (new)
- `src/components/notes/NotebookDialog.tsx` (new)
- `src/components/notes/StackDialog.tsx` (new)
- `src/components/notes/NotesList.tsx` (update)

- Sidebar with notebooks and stacks tree view
- Create/edit/delete notebooks and stacks
- Color coding and icons for notebooks
- Drag-and-drop organization
- Filter notes by notebook/stack

### 4. Note Attachments System

**Files:**

- `src/components/notes/NoteAttachments.tsx` (new)
- `src/components/notes/AttachmentUpload.tsx` (new)
- `src/components/notes/PDFViewer.tsx` (new)
- `src/components/notes/ImageAnnotation.tsx` (new)

- Upload files, images, PDFs to Supabase Storage
- Display attachments in notes
- PDF viewer with annotation (highlight, draw, text)
- Image annotation (draw, highlight, text)
- OCR for images (extract text from images)
- Preview attachments inline

### 5. Advanced Search

**Files:**

- `src/components/notes/NotesSearch.tsx` (new)
- `src/components/notes/SearchFilters.tsx` (new)

- Full-text search with Boolean operators (AND, OR, NOT)
- Search by title, content, tags, notebook
- Date range filters
- Attachment type filters
- Saved searches
- Search within attachments (OCR text)

### 6. Note Templates

**Files:**

- `src/components/notes/TemplatesManager.tsx` (new)
- `src/components/notes/TemplateSelector.tsx` (new)

- Create/edit/delete templates
- Template library (meeting notes, project plan, etc.)
- Apply template when creating note
- Template variables/placeholders

### 7. Version History

**Files:**

- `src/components/notes/VersionHistory.tsx` (new)
- `src/components/notes/VersionViewer.tsx` (new)

- Auto-save versions on significant changes
- View version history timeline
- Compare versions side-by-side
- Restore to previous version
- Version notes/comments

### 8. Note Editing & Enhanced UI

**Files:**

- `src/components/notes/EditNoteDialog.tsx` (new)
- `src/components/notes/NoteCard.tsx` (new)
- `src/components/notes/NotesList.tsx` (update)

- Edit existing notes
- Pin/favorite notes
- Note preview with rich text rendering
- Multiple view modes (grid, list, compact)
- Sort options (date, title, notebook, tags)
- Bulk operations (delete, move, tag)

### 9. Tags Management

**Files:**

- `src/components/notes/TagsManager.tsx` (new)
- `src/components/notes/TagInput.tsx` (new)

- Tag autocomplete
- Tag color coding
- Tag filtering
- Tag statistics
- Merge/rename tags

### 10. Note Linking & References

**Files:**

- `src/components/notes/NoteLink.tsx` (new)
- `src/components/notes/LinkedNotes.tsx` (new)

- Link notes to each other
- Backlinks (notes that link to this note)
- Reference graph visualization
- Wiki-style linking with [[note title]]

### 11. Tasks Integration in Notes

**Files:**

- `src/components/notes/NoteTasks.tsx` (new)
- Update existing task system to link with notes

- Create tasks within notes
- Task checkboxes in notes
- Link existing tasks to notes
- Task reminders from notes

### 12. Calendar Integration Enhancement

**Files:**

- `src/components/notes/CalendarIntegration.tsx` (update)

- Link notes to calendar events
- Create notes from calendar events
- Show notes in calendar view
- Event-based note reminders

### 13. Sharing & Collaboration

**Files:**

- `src/components/notes/ShareNoteDialog.tsx` (new)
- `src/components/notes/SharedNotesList.tsx` (new)

- Share notes with other users
- Permission levels (view, edit)
- Shared notes indicator
- Activity log for shared notes

### 14. Reminders & Notifications

**Files:**

- `src/components/notes/NoteReminder.tsx` (new)
- `src/components/notes/RemindersList.tsx` (new)

- Set reminders for notes
- Notification system
- Reminder list view
- Recurring reminders

### 15. Email Integration

**Files:**

- `src/components/notes/EmailIntegration.tsx` (new)
- Supabase Edge Function: `email-to-note`

- Generate unique email address per user
- Forward emails to create notes
- Parse email content (subject, body, attachments)
- Email-to-note conversion

### 16. Advanced UI Features

**Files:**

- `src/components/notes/NotesModule.tsx` (update)
- `src/components/notes/NotesDashboard.tsx` (new)

- Home dashboard with widgets
- Pinned notes section
- Recent notes
- Quick note creation
- Keyboard shortcuts
- Dark mode support (already exists)

### 17. Offline Support

**Files:**

- `src/hooks/use-offline-notes.ts` (new)
- Service worker updates

- Cache notes locally
- Offline editing
- Sync when online
- Conflict resolution

### 18. Mobile Optimization

- Responsive design improvements
- Touch gestures
- Mobile-specific UI patterns
- Camera integration for attachments

## Implementation Order

1. Database schema (foundation)
2. Rich text editor (core editing)
3. Notebooks/stacks (organization)
4. Note editing & enhanced UI
5. Attachments & annotations
6. Search functionality
7. Templates & version history
8. Advanced features (sharing, reminders, email)
9. Polish & optimization

## Key Dependencies

- TipTap or similar rich text editor library
- PDF.js for PDF viewing
- Canvas API for annotations
- Supabase Storage for attachments
- Full-text search (PostgreSQL)

### To-dos

- [ ] Create database migration for notebooks, stacks, attachments, versions, templates, shares, and enhanced personal_notes schema
- [ ] Implement rich text editor component with TipTap, supporting formatting, tables, images, and markdown
- [ ] Build notebooks and stacks organization system with sidebar, CRUD operations, and tree view
- [ ] Add note editing capability with EditNoteDialog and update NotesList to support editing
- [ ] Implement file attachment system with upload, preview, and Supabase Storage integration
- [ ] Add PDF viewer with annotation capabilities (highlight, draw, text) using PDF.js
- [ ] Implement image annotation with drawing, highlighting, and text overlay using Canvas API
- [ ] Build advanced search with Boolean operators, filters, full-text search, and saved searches
- [ ] Create note templates system with template library, creation, and application
- [ ] Implement version history with auto-save, timeline view, comparison, and restore functionality
- [ ] Build tags management UI with autocomplete, color coding, filtering, and statistics
- [ ] Add note linking system with backlinks, reference graph, and wiki-style [[links]]
- [ ] Integrate tasks within notes, allowing task creation and linking from note context
- [ ] Implement note sharing with permissions, shared notes list, and activity tracking
- [ ] Add note reminders system with notifications and reminders list view
- [ ] Create email-to-note integration with unique email addresses and parsing
- [ ] Build home dashboard with widgets, pinned notes, recent notes, and quick actions
- [ ] Implement offline support with local caching, offline editing, and sync on reconnect