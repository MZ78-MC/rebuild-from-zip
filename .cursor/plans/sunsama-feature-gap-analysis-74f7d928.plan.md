<!-- 74f7d928-8b3f-4f3d-8f10-03d42232b411 1da33feb-4c7a-40ad-bdb8-2d827e445104 -->
# Tasks UI Redesign for Better Usability

## Current Issues

- Calendar sidebar takes only 1/4 of width (lg:grid-cols-4), leaving timeline cramped
- Calendar design is basic and could be more visually appealing
- Controls and filters are spread across multiple rows
- Timeline could use more horizontal space for better task visibility
- Calendar is collapsible but takes valuable space when open

## Proposed Improvements

### 1. Layout Optimization

- **Wider Calendar**: Change from 1/4 to 1/3 width (grid-cols-3) for better calendar visibility
- **Horizontal Calendar Option**: Add option for horizontal mini-calendar above timeline
- **Better Space Distribution**: Optimize grid layout for wider screens (xl:grid-cols-5 for even better distribution)

### 2. Enhanced Calendar Design

- **Larger Calendar Cells**: Make calendar dates more clickable and visible
- **Better Visual Hierarchy**: Improve task count badges with better styling
- **Week View Toggle**: Add option to see week view alongside month view
- **Today Indicator**: More prominent "today" highlighting
- **Selected Date Styling**: Better visual feedback for selected date
- **Task Density Visualization**: Color-code dates based on task count

### 3. Timeline Improvements

- **Wider Timeline**: Use more horizontal space when calendar is visible
- **Better Task Blocks**: Larger, more readable task blocks in timeline
- **Time Column Width**: Optimize time column to not waste space
- **Scroll Optimization**: Better horizontal scrolling if needed

### 4. Controls Reorganization

- **Compact Header**: Consolidate controls into more compact layout
- **Better Button Grouping**: Group related actions together
- **Floating Actions**: Consider floating action buttons for common tasks
- **Quick Access Bar**: Create a persistent quick access bar

### 5. Responsive Design

- **Mobile Optimization**: Ensure calendar collapses properly on mobile
- **Tablet Layout**: Better layout for medium screens
- **Desktop Optimization**: Take full advantage of wide screens

## Implementation Details

### Files to Modify

- `src/components/notes/TasksList.tsx` - Main layout and calendar integration
- `src/components/ui/calendar.tsx` - Calendar component styling (if needed)

### Key Changes

1. Update grid layout from `lg:grid-cols-4` to `lg:grid-cols-3` or `xl:grid-cols-5`
2. Enhance calendar styling with better colors, spacing, and visual indicators
3. Improve task count badges with gradients and better positioning
4. Optimize timeline width calculations
5. Reorganize header controls for better space usage
6. Add horizontal calendar option as alternative view