# AI Tutor Feedback System

## Overview
The feedback system allows students to rate AI responses as helpful (thumbs up) or not helpful (thumbs down). This data helps improve the AI tutor's performance and identify areas where explanations need improvement.

## Features

### 1. **Simple Feedback UI**
- Thumbs up/down buttons appear on all AI messages
- Visual feedback when hovering or selecting
- Toggle behavior (click again to remove feedback)
- Persisted across sessions

### 2. **Real-time Updates**
- Optimistic UI updates for instant feedback
- Automatic sync with database
- Loading states to prevent double-clicks

### 3. **Analytics**
- Track overall satisfaction rate
- View feedback by file/document
- Future: Track feedback by chapter and topic

## Implementation Details

### Database Schema
```prisma
model MessageFeedback {
  id            String       @id @default(cuid())
  messageId     String       @unique
  fileId        String
  feedbackType  FeedbackType
  feedbackReason String?     @db.Text()
  
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  
  message       Message      @relation(fields: [messageId], references: [id], onDelete: Cascade)
  file          File         @relation(fields: [fileId], references: [id], onDelete: Cascade)
}

enum FeedbackType {
  THUMBS_UP
  THUMBS_DOWN
}
```

### TRPC Endpoints

1. **submitFeedback**: Toggle feedback on/off with optional reason
2. **getMessageFeedback**: Retrieve existing feedback for a message
3. **getFeedbackStats**: Get analytics for a specific file

### React Hook
The `useMessageFeedback` hook manages:
- Optimistic updates for instant UI response
- Error handling with rollback
- Cache management
- Loading states

### UI Components

1. **Message.tsx**: Updated to show feedback buttons for AI messages
2. **FeedbackStats.tsx**: Analytics component showing satisfaction rate
3. **Icons**: Using lucide-react ThumbsUp/ThumbsDown icons

## Usage

### For Students
1. After receiving an AI response, click thumbs up if helpful or thumbs down if not
2. Click again to remove feedback
3. Feedback is saved automatically

### For Analytics
Add the FeedbackStats component to any page:
```tsx
import { FeedbackStats } from '@/components/FeedbackStats'

// In your component
<FeedbackStats fileId={fileId} />
```

## Future Enhancements

1. **Detailed Feedback**
   - Add optional text input for specific feedback
   - Categories: "Too complex", "Not accurate", etc.

2. **Advanced Analytics**
   - Feedback by chapter/topic
   - Time-based trends
   - Correlation with quiz scores

3. **AI Improvements**
   - Use feedback to fine-tune responses
   - Identify problematic topics
   - Personalize teaching style

4. **Feedback Actions**
   - For thumbs down: Offer to rephrase
   - Suggest alternative resources
   - Notify when similar content improves

## Best Practices

1. **Performance**
   - Feedback queries are cached with infinite stale time
   - Optimistic updates prevent UI lag
   - Batch analytics queries when possible

2. **UX Design**
   - Subtle UI that doesn't distract from learning
   - Clear visual feedback for selections
   - Accessible with keyboard navigation

3. **Privacy**
   - No user identification (since no auth)
   - Aggregate data for analytics
   - Optional detailed feedback only
